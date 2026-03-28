# RAG 管線，協調檢索和生成

import json
from typing import List, Dict, Any, Optional
from vector_store import vector_store
from knowledge_base import knowledge_base
from vitals_analyzer import vitals_analyzer

class RAGPipeline:
    def __init__(self):
        self.knowledge_base = knowledge_base
    
    def retrieve_relevant_knowledge(self, query: str, category: str = None, n_results: int = 3) -> List[Dict[str, Any]]:
        """檢索相關醫學知識"""
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
            
            # 即使沒有原始文字，只要有生命徵象異常也要進行檢索
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
                    # 沒有生命徵象時，檢查是否需要使用 RAG
                    query = f"症狀：{original_text}"
                    retrieved_docs = self.retrieve_relevant_knowledge(query, None, 1)  # 減少到1個結果
                    
                    # 檢查檢索結果是否與輸入相關
                    if retrieved_docs:
                        context = self.format_context_for_llm(retrieved_docs)
                        # 簡單的相關性檢查：如果檢索結果中沒有包含輸入文字的關鍵詞，就不使用 RAG
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
重要：請優先考慮生命徹象異常提供的症狀，不要被檢索到的醫學知識干擾。
生命徵象異常是客觀測量結果，比檢索到的文獻更可靠。
"""
                
                # 如果沒有檢索結果，提供更簡單的指令
                if not retrieved_docs:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊整理症狀關鍵詞：

{text_section}{vitals_summary}

{priority_instruction}
請從上述主訴中提取主要症狀關鍵詞。
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
範例格式：胸痛、呼吸困難、發燒、高血壓

請只回傳症狀關鍵詞，不要加任何解釋。
"""
                else:
                    enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊提供症狀分析：

{context}

{text_section}{vitals_summary}

{priority_instruction}
請參考上述醫學知識，整理出主要症狀關鍵詞。
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
範例格式：胸痛、呼吸困難、發燒、高血壓

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
範例格式：胸痛、呼吸困難、發燒、高血壓

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
                # 建立生命徵象症狀到症狀庫的映射
                vitals_to_symptoms_mapping = {
                    "發燒": ["發燒", "體溫過高", "發熱"],
                    "高燒": ["高燒", "體溫過高", "發熱", "發燒"],
                    "超高熱": ["超高熱", "體溫過高", "發熱", "高燒", "發燒"],
                    "輕度高血壓": ["輕度高血壓", "高血壓", "血壓過高"],
                    "重度高血壓": ["重度高血壓", "高血壓", "血壓過高", "嚴重高血壓"],
                    "嚴重高血壓": ["嚴重高血壓", "高血壓", "血壓過高", "重度高血壓"],
                    "低血壓": ["低血壓", "血壓過低"],
                    "心跳過速": ["心跳過速", "心悸", "心跳快"],
                    "心跳過緩": ["心跳過緩", "心跳慢"],
                    "輕微低血氧": ["輕微低血氧", "低血氧", "血氧過低"],
                    "嚴重低血氧": ["嚴重低血氧", "低血氧", "血氧過低", "缺氧"],
                    "呼吸急促": ["呼吸急促", "呼吸困難", "呼吸快"],
                    "呼吸過緩": ["呼吸過緩", "呼吸慢"],
                    "高血糖": ["高血糖", "血糖過高"],
                    "低血糖": ["低血糖", "血糖過低", "血糖偏低"]
                }
                
                # 找到匹配的症狀
                matched_symptoms = []
                for vital_symptom in vitals_symptoms:
                    possible_symptoms = vitals_to_symptoms_mapping.get(vital_symptom, [vital_symptom])
                    for symptom in possible_symptoms:
                        if symptom in symptom_candidates:
                            matched_symptoms.append(symptom)
                            break
                
                # 如果找到匹配的症狀，直接返回
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
                
                retrieved_docs = self.retrieve_relevant_knowledge(query, 'symptoms', 3)
                
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
    
    def enhance_triage_recommendation(self, symptoms: List[str], vitals: Dict[str, str] = None) -> str:
        """使用 RAG 增強檢傷分級建議"""
        # 檢索檢傷分級指引
        query = f"症狀：{', '.join(symptoms)}"
        retrieved_docs = self.retrieve_relevant_knowledge(query, 'triage_level', 3)
        
        # 格式化上下文
        context = self.format_context_for_llm(retrieved_docs)
        
        # 建構增強的 prompt
        vitals_info = ""
        if vitals:
            vitals_info = f"\n生命徵象：{json.dumps(vitals, ensure_ascii=False)}"
        
        enhanced_prompt = f"""
你是一位急診分級專家。請根據以下資訊提供檢傷分級建議：

{context}

症狀：{', '.join(symptoms)}{vitals_info}

請參考上述檢傷指引，建議最適合的檢傷分級（1-5級）並說明理由。
格式：
分級：[數字]
理由：[說明]
"""
        return enhanced_prompt
    
    def search_emergency_protocol(self, condition: str) -> str:
        """搜尋急診處理協議"""
        retrieved_docs = self.retrieve_relevant_knowledge(condition, 'emergency_protocol', 1)
        
        if retrieved_docs:
            protocol = retrieved_docs[0].get('content', '')
            return f"急診處理協議：{protocol}"
        else:
            return "沒有找到相關的急診協議，請遵循標準急診處理程序。"

# 初始化 RAG 管線
rag_pipeline = RAGPipeline()