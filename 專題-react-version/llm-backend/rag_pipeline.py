# RAG 管線，協調檢索和生成

import json
from typing import Any, Dict, List, Optional, Tuple
from knowledge_base import knowledge_base
from vitals_analyzer import vitals_analyzer

# 主訴 → 症狀關鍵詞時共用：強制繁中、忠實原文、避免英文殘留與臆測症狀
CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES = """
【輸出格式與語言】
- 只輸出一行症狀關鍵詞，以頓號（、）分隔；不要前綴、後綴、說明或「症狀關鍵詞：」等標籤。
- 每個關鍵詞必須為台灣繁體中文；不得保留英文、拼音或中英混雜（例如不得出現 coughing、blood、fever）。
- 用詞精準：長期咳嗽口述整理為「咳嗽」；痰中帶血、咯血、coughed up blood 等一律整理為「咳血」，勿寫成「血液出血」等冗贅或非慣用說法。
- 不得輸出截斷或省略字尾的關鍵詞（例如「嚴重意識障」屬不完整，應為「嚴重意識障礙」；但若原文無此完整詞且系統未提供，請勿自行生成）。

【忠實度】
- 僅列出原始主訴字面或語意上明確提及的症狀；嚴禁臆測或補寫未提及的症狀。
- 若原文未提到發燒，且所提供的生命徵象分析也未將體溫判為異常發燒，則不得輸出「發燒」「高燒」等。
- 參考摘錄或醫學知識僅供對照用語，不得因而新增主訴未出現的症狀。
- 相同症狀只輸出一次，勿重複（例如「骨折、骨折」應合併為一個「骨折」）。

【外傷機轉保留（重要）】
- 若原文提及車禍、跌倒、撞到、刀傷、燒燙傷等外傷機轉，必須保留於輸出（例：車禍、跌倒、撞到），不可只輸出骨折、疼痛等結果性症狀而刪除機轉。
- 外傷機轉詞與症狀詞並列，例如：車禍、骨折、疼痛。

【生命徵象數值處理（重要）】
- 若原始主訴中夾雜了生命徵象數值或縮寫（例如「GCS 8」「E2V2M4」「血壓 240/200」「血糖 169」「SpO2 88%」等），請依字面整理觀察性描述，勿臆測未提及的症狀。
- 若另提供「生命徵象測量值」或「客觀異常」區塊，請優先參考該區塊；客觀異常僅含少數有明確臨床門檻的項目（如發燒、低血氧、低血壓、高血壓危象、低血糖、意識障礙等），其餘數值請搭配檢索知識謹慎解讀，勿將輕微偏離正常值自動升級為「輕度/重度高血壓」等分級詞。
- 血壓略高於正常但未到高血壓危象門檻時，不得僅因數值就輸出「高血壓」「高血壓急症」等結論性症狀，除非主訴明確提及。
- 對於明顯的觀察性描述（例如「意識改變」「右側肢體無力」「呼吸喘」），照原文語意整理即可。
"""

class RAGPipeline:
    def __init__(self):
        # 這裡不自己建 DB，直接共用全域 knowledge_base 物件
        self.knowledge_base = knowledge_base
        # 症狀名稱 embedding 快取：第一次見到就計算，後續直接重用，避免每次推薦都重新 encode。
        # 候選清單其實是 TTAS DB 裡固定的一群字串，所以快取命中率很高。
        self._symptom_embedding_cache: Dict[str, List[float]] = {}

    def retrieve_relevant_knowledge(self, query: str, category: str = None, n_results: int = 3) -> List[Dict[str, Any]]:
        """檢索相關醫學知識"""
        # 單純代理到知識庫層，方便後續統一加 retry 或 logging
        try:
            results = self.knowledge_base.search_medical_knowledge(query, category, n_results)
            return results
        except Exception as e:
            print(f"❌ 檢索失敗: {e}")
            return []

    # ------------------------------------------------------------------
    # 症狀名稱語意檢索（Phase 1 取代字面 substring 過濾）
    # ------------------------------------------------------------------
    def _ensure_candidate_embeddings(self, candidates: List[str]) -> Dict[str, List[float]]:
        """確保所有候選都有 embedding。第一次見到的會一次性批次計算。"""
        missing = [c for c in candidates if c and c not in self._symptom_embedding_cache]
        if missing:
            try:
                vecs = self.knowledge_base.embed_texts(missing)
                for name, vec in zip(missing, vecs):
                    self._symptom_embedding_cache[name] = vec
                print(f"[RAG] 為 {len(missing)} 個候選症狀建立 embedding（總快取 {len(self._symptom_embedding_cache)} 筆）")
            except Exception as e:
                print(f"❌ 計算候選症狀 embedding 失敗：{e}")
        return self._symptom_embedding_cache

    @staticmethod
    def _dot_product(a: List[float], b: List[float]) -> float:
        # embeddings 已 normalize，dot product == cosine similarity
        if not a or not b or len(a) != len(b):
            return 0.0
        return float(sum(x * y for x, y in zip(a, b)))

    def find_similar_symptoms(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 20,
        min_score: float = 0.0,
    ) -> List[str]:
        """從候選症狀清單中，依語意相似度回傳最相近的前 top_k 個。

        - 用於取代前端的 substring 過濾。
        - candidates 必須是「實際存在於系統的症狀名稱」清單，回傳結果不會超出此範圍。
        - 若 query 為空、embedding 出錯或候選為空，會退回前 top_k 個候選（保持流程不中斷）。
        """
        clean_candidates = [c for c in (candidates or []) if isinstance(c, str) and c.strip()]
        if not clean_candidates:
            return []
        if not (query or "").strip():
            return clean_candidates[:top_k]
        try:
            cache = self._ensure_candidate_embeddings(clean_candidates)
            query_vec = self.knowledge_base.embed_query(query)
            scored: List[Tuple[float, str]] = []
            for name in clean_candidates:
                vec = cache.get(name)
                if not vec:
                    continue
                score = self._dot_product(query_vec, vec)
                if score < min_score:
                    continue
                scored.append((score, name))
            scored.sort(key=lambda x: x[0], reverse=True)
            return [name for _, name in scored[:top_k]]
        except Exception as e:
            print(f"❌ 症狀語意檢索失敗，回退原順序：{e}")
            return clean_candidates[:top_k]
    
    def format_context_for_llm(self, retrieved_docs: List[Dict[str, Any]]) -> str:
        """將檢索到的文檔格式化為 LLM 可用的上下文"""
        if not retrieved_docs:
            return "沒有找到相關的醫學知識。"
        
        # context 盡量維持固定格式，讓模型比較容易抓重點
        context = "相關醫學知識：\n\n"
        for i, doc in enumerate(retrieved_docs, 1):
            content = doc.get('content', '')
            metadata = doc.get('metadata', {})
            
            context += f"知識 {i}：{content}\n"
            
            # 添加額外資訊
            if metadata.get('urgency'):
                context += f"緊急程度：{metadata['urgency']}\n"
            if metadata.get('keywords'):
                context += f"關鍵詞：{', '.join(metadata['keywords'])}\n"
            
            context += "---\n"
        
        return context
    
    def enhance_symptom_summary(self, original_text: str, symptoms: List[str] = None, vitals: Dict[str, Any] = None) -> str:
        """使用 RAG 增強症狀摘要，整合生命徵象分析"""
        try:
            vitals_symptoms = []
            vitals_section = ""
            vitals_context = ""

            if vitals:
                vitals_context = vitals_analyzer.format_vitals_for_llm(vitals)
                vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
                if vitals_context:
                    vitals_section += f"\n\n生命徵象測量值：{vitals_context}"
                if vitals_symptoms:
                    vitals_section += f"\n\n客觀異常（有明確臨床門檻）：{', '.join(vitals_symptoms)}"
                    print(f"[RAG] 檢測到生命徵象客觀異常：{vitals_symptoms}")

            all_symptoms = []
            if symptoms:
                all_symptoms.extend(symptoms)
            if vitals_symptoms:
                all_symptoms.extend(vitals_symptoms)

            if all_symptoms or vitals_context or original_text:
                query_parts = []
                if original_text:
                    query_parts.append(f"主訴：{original_text}")
                if all_symptoms:
                    query_parts.append(f"症狀：{', '.join(all_symptoms)}")
                if vitals_context:
                    query_parts.append(f"生命徵象：{vitals_context}")
                query = " ".join(query_parts)
                retrieved_docs = self.retrieve_relevant_knowledge(query, None, 2)
            else:
                retrieved_docs = []
            
            # 格式化上下文
            context = self.format_context_for_llm(retrieved_docs)
            
            # 建構增強的 prompt
            if original_text:
                text_section = f"原始主訴：{original_text}"
            else:
                text_section = "原始主訴：無明確主訴（僅生命徵象異常）"
            
            if not original_text and vitals:
                if vitals_symptoms:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。以下為純生命徵象輸入（無文字主訴）：

{text_section}{vitals_section}

請「僅」列出上方「客觀異常（有明確臨床門檻）」區塊中已有的標籤，不得新增、刪改或從測量值推論其他症狀。
禁止輸出胸痛、呼吸困難、出汗等未在客觀異常中列出的詞彙。
請嚴格使用頓號（、）分隔。
範例：發燒、心跳過緩

請只回傳症狀關鍵詞，不要加任何解釋。
"""
                else:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。以下為純生命徵象輸入，且未達任何客觀異常門檻：

{text_section}{vitals_section}

請回傳空字串，不要輸出任何症狀關鍵詞。
"""
            else:
                # 有文字輸入時，使用完整的 RAG 增強，但優先考慮生命徵象
                if vitals_symptoms:
                    # 如果有生命徵象異常，優先使用生命徵象，限制 RAG 檢索
                    query = f"症狀：{original_text}"
                    # 只檢索少量相關資料，避免干擾
                    retrieved_docs = self.retrieve_relevant_knowledge(query, None, 1)  # 只檢索1個結果
                else:
                    # 沒有 vitals 干擾時，先做一次低成本檢索
                    query = f"症狀：{original_text}"
                    retrieved_docs = self.retrieve_relevant_knowledge(query, None, 1)  # 減少到1個結果
                    
                    # 檢查檢索結果是否與輸入相關
                    if retrieved_docs:
                        context = self.format_context_for_llm(retrieved_docs)
                        # 簡單防呆：避免抓到完全不相干的知識把模型帶偏
                        input_keywords = set(original_text.replace('我', '').replace('覺得', '').replace('很', '').replace('難受', '').split())
                        context_lower = context.lower()
                        relevant = len(input_keywords) > 0 and any(keyword in context_lower for keyword in input_keywords if len(keyword) > 1)
                        
                        if not relevant:
                            print(f"[RAG] 檢索結果與輸入不相關，跳過 RAG")
                            retrieved_docs = []
                
                # 格式化上下文
                context = self.format_context_for_llm(retrieved_docs)
                
                # 建構增強的 prompt
                if original_text:
                    text_section = f"原始主訴：{original_text}"
                else:
                    text_section = "原始主訴：無明確主訴（僅生命徵象異常）"
                
                # 如果有生命徵象，強調優先考慮生命徵象
                priority_instruction = ""
                if vitals_context or vitals_symptoms:
                    priority_instruction = """
重要：請優先參考「生命徵象測量值」與「客觀異常」區塊；客觀異常為有明確臨床門檻的項目，應納入。
其餘數值請勿自行套用分級規則（如輕度/重度高血壓），僅在與主訴或檢索知識高度相關時才整理為症狀。
"""
                
                # 沒撈到可靠 context，就退回較保守的 prompt
                if not retrieved_docs:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊整理症狀關鍵詞：

{text_section}{vitals_section}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}
{priority_instruction}
請從上述主訴與生命徵象中提取主要症狀關鍵詞（無主訴則依生命徵象與客觀異常）。

請嚴格使用頓號（、）分隔症狀。
範例格式：咳嗽、咳血

請只回傳症狀關鍵詞，不要加任何解釋。
"""
                else:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊提供症狀分析：

{context}

{text_section}{vitals_section}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}
{priority_instruction}
不要預設最嚴重情況；依主訴、生命徵象測量值與客觀異常整理，資訊不足時勿添加未提及之危急症狀。
請參考上述摘錄僅作用詞對照，整理出主要症狀關鍵詞。

請嚴格使用頓號（、）分隔症狀。
範例格式：咳嗽、咳血

請只回傳症狀關鍵詞，不要加任何解釋。
"""
            return enhanced_prompt
        except Exception as e:
            print(f"❌ RAG 增強失敗: {e}")
            # 失敗時回傳簡單 prompt（但仍然包含生命徵象分析）
            vitals_symptoms = []
            vitals_section = ""

            if vitals:
                vitals_context = vitals_analyzer.format_vitals_for_llm(vitals)
                vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
                if vitals_context:
                    vitals_section += f"\n\n生命徵象測量值：{vitals_context}"
                if vitals_symptoms:
                    vitals_section += f"\n\n客觀異常（有明確臨床門檻）：{', '.join(vitals_symptoms)}"

            text_section = original_text if original_text else "原始主訴：無明確主訴（僅生命徵象）"

            return f"""
你是一位急診分級護理師助手。請從以下資訊中整理出症狀關鍵詞：

{text_section}{vitals_section}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}

請嚴格使用頓號（、）分隔症狀，不要使用其他符號。
範例格式：咳嗽、咳血

請只回傳症狀關鍵詞，不要加任何解釋。
"""
    
    def enhance_symptom_recommendations(self, text: str, symptom_candidates: List[str], vitals: Dict[str, Any] = None, max_results: int = 10) -> str:
        """使用 RAG 增強症狀推薦，整合生命徵象分析"""
        try:
            vitals_symptoms = []
            vitals_section = ""
            vitals_context = ""

            if vitals:
                vitals_context = vitals_analyzer.format_vitals_for_llm(vitals)
                vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
                if vitals_context:
                    vitals_section += f"\n\n生命徵象測量值：{vitals_context}"
                if vitals_symptoms:
                    vitals_section += f"\n\n客觀異常（有明確臨床門檻）：{', '.join(vitals_symptoms)}"
                    print(f"[RAG] 推薦時檢測到生命徵象客觀異常：{vitals_symptoms}")
            
            # 建構候選症狀清單
            candidate_lines = "\n".join(f"- {name}" for name in symptom_candidates)
            
            query_parts = []
            if text:
                query_parts.append(f"症狀推薦：{text}")
            if vitals_symptoms:
                query_parts.append(f"客觀異常：{', '.join(vitals_symptoms)}")
            if vitals_context:
                query_parts.append(f"生命徵象：{vitals_context}")
            query = " ".join(query_parts) if query_parts else f"症狀推薦：{text or vitals_context}"

            retrieved_docs = self.retrieve_relevant_knowledge(query, None, 3)
            context = self.format_context_for_llm(retrieved_docs)

            enhanced_prompt = f"""
你是一位熟悉台灣急診分級系統的護理師助手。請根據以下資訊推薦症狀：

{context}

主訴內容：{text or '（無文字主訴，僅生命徵象）'}{vitals_section}

候選症狀清單（只能從這些裡面選）：
{candidate_lines}

請參考上述醫學知識，從候選清單中選出 1 到 {max_results} 個最適合的症狀。
請特別注意：
- 優先參考「客觀異常」區塊中有明確臨床門檻的項目。
- 勿僅因血壓略高就推薦高血壓急症；僅在達高血壓危象門檻或主訴明確相關時才推薦。
- 若候選清單與主訴、生命徵象均無明顯相關，請回傳空陣列。

如果候選清單裡沒有跟主訴或生命徵象明顯相關的症狀，請回傳空的 JSON 陣列 []。
請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。
範例：["頭痛", "胸痛", "發燒"]
"""
            return enhanced_prompt
        except Exception as e:
            print(f"❌ RAG 症狀推薦增強失敗: {e}")
            # 失敗時回傳簡單 prompt（但仍然包含生命徵象分析）
            vitals_symptoms = []
            vitals_section = ""

            if vitals:
                vitals_context = vitals_analyzer.format_vitals_for_llm(vitals)
                vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
                if vitals_context:
                    vitals_section += f"\n\n生命徵象測量值：{vitals_context}"
                if vitals_symptoms:
                    vitals_section += f"\n\n客觀異常（有明確臨床門檻）：{', '.join(vitals_symptoms)}"

            candidate_lines = "\n".join(f"- {name}" for name in symptom_candidates)

            return f"""
你是一位熟悉台灣急診分級系統的護理師助手。

主訴內容：{text}{vitals_section}

候選症狀清單（只能從這些裡面選）：
{candidate_lines}

請從候選清單中選出 1 到 {max_results} 個最適合的症狀。
如果候選清單裡沒有跟主訴明顯相關的症狀，請回傳空的 JSON 陣列 []。
請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。
範例：["頭痛", "胸痛", "發燒"]
"""
    
    def enhance_triage_recommendation(
        self,
        symptoms: List[str],
        vitals: Dict[str, Any] = None,
        n_docs: int = 8,
        pre_retrieved: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        產生給 LLM 的 prompt：僅症狀整理與 TTAS 規則引用。
        檢傷級別須由規則層決定，不得請模型直接輸出分級。
        """
        if pre_retrieved is not None:
            retrieved_docs = pre_retrieved
        else:
            query = f"症狀：{', '.join(symptoms)}"
            retrieved_docs = self.retrieve_relevant_knowledge(query, None, n_docs)
        context = self.format_context_for_llm(retrieved_docs)

        vitals_info = ""
        if vitals:
            vitals_info = f"\n生命徵象（僅供整理，勿過度推論）：{json.dumps(vitals, ensure_ascii=False)}"

        return f"""你是急診檢傷輔助系統（TTAS）。請嚴格遵守：
- 不要預設最嚴重情況；只能依「患者資料」與下方「TTAS 規則摘錄」整理與引用。
- 只能根據提供資料與 TTAS 規則判斷；資訊不足時措辭保守，勿臆測危急狀況。
- 資訊不足時應維持較低嚴重度之描述，不可自行升級為瀕死或需立即急救之情境。
- **禁止輸出檢傷級別**：不可寫「第幾級」、Level、或單獨用 1–5 數字表示分級結論。

患者症狀關鍵詞：{", ".join(symptoms)}
{vitals_info}

TTAS 規則摘錄（向量檢索自官方準則表，非完整全文）：
{context}

請依下列子標題輸出（繁體中文）：
【症狀整理】
【TTAS 規則引用】（逐條摘錄與患者可能相關之準則文字，並註明摘錄來自檢索片段）
（勿包含任何檢傷分級結論或數字分級）
"""
    
    def search_emergency_protocol(self, condition: str) -> str:
        """搜尋急診處理協議（知識庫僅 TTAS CSV 時，改為語意檢索最接近之準則列）"""
        retrieved_docs = self.retrieve_relevant_knowledge(condition, None, 1)
        
        if retrieved_docs:
            protocol = retrieved_docs[0].get('content', '')
            return f"急診處理協議：{protocol}"
        else:
            return "沒有找到相關的急診協議，請遵循標準急診處理程序。"

# 初始化 RAG 管線
rag_pipeline = RAGPipeline()

# --- 檢傷規則層（與 triage-advice 併用；最終級別不由 LLM 單獨決定）---

CRITICAL_SYMPTOM_PHRASES = (
    "心肺停止",
    "無呼吸",
    "沒有呼吸",
    "無脈搏",
    "無脈",
    "瀕死",
    "昏迷",
    "沒意識",
    "意識喪失",
    "大量出血",
    "止不住的血",
    "休克",
    "喘不過氣",
    "窒息",
    "紫紺",
    "抽搐不止",
    "OHCA",
    "到院前死亡",
)


def _safe_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, str) and not v.strip():
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _safe_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(float(str(v).strip()))
    except (TypeError, ValueError):
        return None


def has_explicit_critical_vitals(vitals: Optional[Dict[str, Any]]) -> bool:
    if not vitals:
        return False
    spo2 = _safe_float(vitals.get("spo2"))
    if spo2 is not None and spo2 < 90:
        return True
    sbp = _safe_float(vitals.get("systolicBP"))
    if sbp is not None and sbp < 80:
        return True
    try:
        if all(k in vitals for k in ("gcsEye", "gcsVerbal", "gcsMotor")):
            gcs = int(vitals["gcsEye"]) + int(vitals["gcsVerbal"]) + int(vitals["gcsMotor"])
            if gcs <= 8:
                return True
    except (TypeError, ValueError, KeyError):
        pass
    return False


def has_explicit_critical_symptoms(symptoms: List[str]) -> bool:
    blob = " ".join(s.strip() for s in symptoms if isinstance(s, str) and s.strip())
    if not blob:
        return False
    return any(phrase in blob for phrase in CRITICAL_SYMPTOM_PHRASES)


def _symptom_overlap(symptoms: List[str], doc_symptom: str) -> bool:
    if not doc_symptom or not symptoms:
        return False
    d = str(doc_symptom).strip()
    for s in symptoms:
        t = str(s).strip()
        if not t:
            continue
        if t in d or d in t:
            return True
    return False


def compute_final_ttas_degree(
    symptoms: List[str],
    vitals: Optional[Dict[str, Any]],
    retrieved: List[Dict[str, Any]],
) -> Tuple[int, str]:
    vitals = vitals or {}
    critical_ok = has_explicit_critical_vitals(vitals) or has_explicit_critical_symptoms(
        symptoms
    )

    parsed_rows: List[Tuple[int, str, str, bool]] = []
    for r in retrieved:
        meta = r.get("metadata") or {}
        deg = _safe_int(meta.get("ttas_level"))
        if deg is None or deg < 1 or deg > 5:
            continue
        judge = str(meta.get("judgment") or "")
        doc_sym = str(meta.get("symptom") or "")
        overlap = _symptom_overlap(symptoms, doc_sym)
        parsed_rows.append((deg, judge, doc_sym, overlap))

    if not parsed_rows:
        return 4, "檢索無有效 TTAS 規則列，依保守預設為第四級（請補齊主訴與徵象）。"

    overlapped = [x for x in parsed_rows if x[3]]
    if overlapped:
        candidate = min(x[0] for x in overlapped)
        basis = "主訴與 TTAS 主訴欄位有重疊之規則中，取最嚴重符合級別。"
    else:
        candidate = max(x[0] for x in parsed_rows)
        basis = "檢索規則與主訴關聯性低，取檢索結果中最輕級別以避免過度升級。"

    if candidate == 1 and not critical_ok:
        return (
            2,
            basis
            + " 未偵測到明確危急徵象（生命徵象或主訴關鍵字），依政策不逕予第一級，改為第二級。",
        )

    return candidate, basis


def format_advice_with_rule_layer(
    llm_text: str, final_degree: int, rule_rationale: str
) -> str:
    return (
        f"{llm_text.strip()}\n\n"
        f"【規則層決定之建議檢傷級別】第 {final_degree} 級\n"
        f"【規則說明】{rule_rationale}"
    )