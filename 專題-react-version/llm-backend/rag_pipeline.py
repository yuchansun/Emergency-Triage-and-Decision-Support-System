# RAG 管線，協調檢索和生成

import json
from typing import Any, Dict, List, Optional, Tuple
from knowledge_base import knowledge_base
from vitals_analyzer import match_vital_labels_to_symptom_candidates, vitals_analyzer

# 主訴 → 症狀關鍵詞時共用：強制繁中、忠實原文、避免英文殘留與臆測症狀
CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES = """
【輸出格式與語言】
- 只輸出一行症狀關鍵詞，以頓號（、）分隔；不要前綴、後綴、說明或「症狀關鍵詞：」等標籤。
- 每個關鍵詞必須為台灣繁體中文；不得保留英文、拼音或中英混雜（例如不得出現 coughing、blood、fever）。
- 用詞精準：長期咳嗽口述整理為「咳嗽」；痰中帶血、咯血、coughed up blood 等一律整理為「咳血」，勿寫成「血液出血」等冗贅或非慣用說法。

【忠實度】
- 僅列出原始主訴字面或語意上明確提及的症狀；嚴禁臆測或補寫未提及的症狀。
- 若原文未提到發燒，且所提供的生命徵象分析也未將體溫判為異常發燒，則不得輸出「發燒」「高燒」等。
- 參考摘錄或醫學知識僅供對照用語，不得因而新增主訴未出現的症狀。
"""

class RAGPipeline:
    def __init__(self):
        # 這裡不自己建 DB，直接共用全域 knowledge_base 物件
        self.knowledge_base = knowledge_base
    
    def retrieve_relevant_knowledge(self, query: str, category: str = None, n_results: int = 3) -> List[Dict[str, Any]]:
        """檢索相關醫學知識"""
        # 單純代理到知識庫層，方便後續統一加 retry 或 logging
        try:
            results = self.knowledge_base.search_medical_knowledge(query, category, n_results)
            return results
        except Exception as e:
            print(f"❌ 檢索失敗: {e}")
            return []
    
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
            # 分析生命徵象異常
            vitals_symptoms = []
            vitals_summary = ""
            
            if vitals:
                vitals_symptoms, abnormal_summary = vitals_analyzer.analyze_vitals(vitals)
                if vitals_symptoms:
                    vitals_summary = f"\n\n生命徵象異常分析：{', '.join(vitals_symptoms)}"
                    print(f"[RAG] 檢測到生命徵象異常：{vitals_symptoms}")
            
            # 合併原有症狀和生命徵象症狀
            all_symptoms = []
            if symptoms:
                all_symptoms.extend(symptoms)
            if vitals_symptoms:
                all_symptoms.extend(vitals_symptoms)
            
            # 沒有文字也可以靠生命徵象做檢索（例如現場只先量到 vitals）
            if all_symptoms:
                query = f"症狀：{', '.join(all_symptoms)}"
                if vitals_symptoms:
                    query += f" 生命徵象：{', '.join(vitals_symptoms)}"
                retrieved_docs = self.retrieve_relevant_knowledge(query, None, 2)  # 不限制類別
            elif original_text:
                query = f"症狀：{original_text}"
                retrieved_docs = self.retrieve_relevant_knowledge(query, None, 2)  # 不限制類別
            else:
                # 如果沒有文字也沒有生命徵象異常，就不進行 RAG 檢索
                retrieved_docs = []
            
            # 格式化上下文
            context = self.format_context_for_llm(retrieved_docs)
            
            # 建構增強的 prompt
            if original_text:
                text_section = f"原始主訴：{original_text}"
            else:
                text_section = "原始主訴：無明確主訴（僅生命徵象異常）"
            
            # 如果是純生命徵象輸入（沒有文字），使用簡化的 prompt
            if not original_text and vitals_symptoms:
                enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下生命徵象異常分析，整理出症狀關鍵詞：

{text_section}{vitals_summary}

請嚴格只根據上述生命徵象異常分析整理症狀，不要添加其他不相關的症狀。
請特別注意：
- 體溫 >= 38°C 要識別為「發燒」
- 體溫 >= 39°C 要識別為「高燒」
- 體溫 >= 40°C 要識別為「超高熱」
- 血壓收縮壓 >= 140 mmHg 要識別為「高血壓」
- 血壓收縮壓 >= 160 mmHg 要識別為「重度高血壓」
- 血壓收縮壓 >= 180 mmHg 要識別為「嚴重高血壓」
- 心跳 >= 120 次/分 要識別為「心跳過速」
- 心跳 < 60 次/分 要識別為「心跳過緩」
- 血氧 < 94% 要識別為「低血氧」
- 其他生命徵象異常也要正確識別

請嚴格使用頓號（、）分隔症狀，不要使用其他符號。
範例格式：發燒、高血壓

請只回傳基於生命徵象的症狀關鍵詞，不要加任何解釋，不要添加不相關症狀。
請確保回傳的症狀與生命徵象異常完全對應。
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
                if vitals_symptoms:
                    priority_instruction = """
重要：請優先考慮生命徵象異常提供的症狀，不要被檢索到的醫學知識干擾。
生命徵象異常是客觀測量結果，比檢索到的文獻更可靠。
"""
                
                # 沒撈到可靠 context，就退回較保守的 prompt
                if not retrieved_docs:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊整理症狀關鍵詞：

{text_section}{vitals_summary}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}
{priority_instruction}
請從上述主訴與生命徵象分析中提取主要症狀關鍵詞（無則僅依主訴）。
若下方有數值型生命徵象之判讀規則，僅在有對應測值時適用：
- 體溫 >= 38°C 要識別為「發燒」
- 體溫 >= 39°C 要識別為「高燒」
- 體溫 >= 40°C 要識別為「超高熱」
- 血壓收縮壓 >= 140 mmHg 要識別為「高血壓」
- 血壓收縮壓 >= 160 mmHg 要識別為「重度高血壓」
- 血壓收縮壓 >= 180 mmHg 要識別為「嚴重高血壓」
- 心跳 >= 120 次/分 要識別為「心跳過速」
- 心跳 < 60 次/分 要識別為「心跳過緩」
- 血氧 < 94% 要識別為「低血氧」
- 其他生命徵象異常也要正確識別

請嚴格使用頓號（、）分隔症狀。
範例格式：咳嗽、咳血

請只回傳症狀關鍵詞，不要加任何解釋。
"""
                else:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊提供症狀分析：

{context}

{text_section}{vitals_summary}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}
{priority_instruction}
不要預設最嚴重情況；只能依主訴與下列生命徵象判讀（若有測值）整理，資訊不足時勿添加未提及之危急症狀。
請參考上述摘錄僅作用詞對照，整理出主要症狀關鍵詞。
若下方有數值型生命徵象之判讀規則，僅在有對應測值時適用：
- 體溫 >= 38°C 要識別為「發燒」
- 體溫 >= 39°C 要識別為「高燒」
- 體溫 >= 40°C 要識別為「超高熱」
- 血壓收縮壓 >= 140 mmHg 要識別為「高血壓」
- 血壓收縮壓 >= 160 mmHg 要識別為「重度高血壓」
- 血壓收縮壓 >= 180 mmHg 要識別為「嚴重高血壓」
- 心跳 >= 120 次/分 要識別為「心跳過速」
- 心跳 < 60 次/分 要識別為「心跳過緩」
- 血氧 < 94% 要識別為「低血氧」
- 其他生命徵象異常也要正確識別

請嚴格使用頓號（、）分隔症狀。
範例格式：咳嗽、咳血

請只回傳症狀關鍵詞，不要加任何解釋。
"""
            return enhanced_prompt
        except Exception as e:
            print(f"❌ RAG 增強失敗: {e}")
            # 失敗時回傳簡單 prompt（但仍然包含生命徵象分析）
            vitals_symptoms = []
            vitals_summary = ""
            
            if vitals:
                vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
                if vitals_symptoms:
                    vitals_summary = f"\n\n生命徵象異常分析：{', '.join(vitals_symptoms)}"
            
            text_section = original_text if original_text else "原始主訴：無明確主訴（僅生命徵象異常）"
            
            return f"""
你是一位急診分級護理師助手。請從以下資訊中整理出症狀關鍵詞：

{text_section}{vitals_summary}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}
請特別注意：
- 體溫 >= 38°C 要識別為「發燒」
- 體溫 >= 39°C 要識別為「高燒」
- 體溫 >= 40°C 要識別為「超高熱」
- 血壓收縮壓 >= 140 mmHg 要識別為「高血壓」
- 血壓收縮壓 >= 160 mmHg 要識別為「重度高血壓」
- 血壓收縮壓 >= 180 mmHg 要識別為「嚴重高血壓」
- 心跳 >= 120 次/分 要識別為「心跳過速」
- 心跳 < 60 次/分 要識別為「心跳過緩」
- 血氧 < 94% 要識別為「低血氧」
- 其他生命徵象異常也要正確識別

請嚴格使用頓號（、）分隔症狀，不要使用其他符號。
範例格式：咳嗽、咳血

請只回傳症狀關鍵詞，不要加任何解釋。
"""
    
    def enhance_symptom_recommendations(self, text: str, symptom_candidates: List[str], vitals: Dict[str, Any] = None, max_results: int = 10) -> str:
        """使用 RAG 增強症狀推薦，整合生命徵象分析"""
        try:
            # 分析生命徵象異常
            vitals_symptoms = []
            vitals_summary = ""
            
            if vitals:
                vitals_symptoms, abnormal_summary = vitals_analyzer.analyze_vitals(vitals)
                if vitals_symptoms:
                    vitals_summary = f"\n\n生命徵象異常：{', '.join(vitals_symptoms)}"
                    print(f"[RAG] 推薦時檢測到生命徵象異常：{vitals_symptoms}")
            
            # 建構候選症狀清單
            candidate_lines = "\n".join(f"- {name}" for name in symptom_candidates)
            
            # 如果是純生命徵象輸入（沒有文字），使用簡化的推薦邏輯
            if not text and vitals_symptoms:
                matched_symptoms = match_vital_labels_to_symptom_candidates(
                    vitals_symptoms, symptom_candidates
                )
                # 純 vitals 情境下，直接走 deterministic mapping，少繞一層 LLM
                if matched_symptoms:
                    return f"""
請從以下症狀中選擇最相關的：

生命徵象異常：{', '.join(vitals_symptoms)}
找到的相關症狀：{', '.join(matched_symptoms)}

請嚴格只輸出 JSON 陣列格式，包含找到的相關症狀。
範例：{json.dumps(matched_symptoms, ensure_ascii=False)}
"""
                else:
                    # 如果沒有找到匹配的症狀，返回空陣列
                    return f"""
生命徵象異常：{', '.join(vitals_symptoms)}
候選症狀清單中沒有找到相關症狀。

請嚴格只輸出空的 JSON 陣列：[]
"""
            else:
                # 有文字輸入時，使用完整的 RAG 增強推薦
                # 檢索相關知識（包含生命徵象資訊）
                query = f"症狀推薦：{text}"
                if vitals_symptoms:
                    query += f" 生命徵象：{', '.join(vitals_symptoms)}"
                
                retrieved_docs = self.retrieve_relevant_knowledge(query, None, 3)
                
                # 格式化上下文
                context = self.format_context_for_llm(retrieved_docs)
                
                enhanced_prompt = f"""
你是一位熟悉台灣急診分級系統的護理師助手。請根據以下資訊推薦症狀：

{context}

主訴內容：{text}{vitals_summary}

候選症狀清單（只能從這些裡面選）：
{candidate_lines}

請參考上述醫學知識，從候選清單中選出 1 到 {max_results} 個最適合的症狀。
請特別注意：
- 如果生命徵象顯示異常（如發燒、高血壓等），請優先推薦相關症狀
- 體溫 >= 38°C 應推薦「發燒」相關症狀
- 血壓異常應推薦「高血壓」或「低血壓」相關症狀
- 心跳異常應推薦「心跳過速」或「心跳過緩」相關症狀
- 血氧異常應推薦「低血氧」相關症狀

如果候選清單裡沒有跟主訴或生命徵象明顯相關的症狀，請回傳空的 JSON 陣列 []。
請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。
範例：["頭痛", "胸痛", "發燒"]
"""
            return enhanced_prompt
        except Exception as e:
            print(f"❌ RAG 症狀推薦增強失敗: {e}")
            # 失敗時回傳簡單 prompt（但仍然包含生命徵象分析）
            vitals_symptoms = []
            vitals_summary = ""
            
            if vitals:
                vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
                if vitals_symptoms:
                    vitals_summary = f"\n\n生命徵象異常：{', '.join(vitals_symptoms)}"
            
            candidate_lines = "\n".join(f"- {name}" for name in symptom_candidates)
            
            return f"""
你是一位熟悉台灣急診分級系統的護理師助手。

主訴內容：{text}{vitals_summary}

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