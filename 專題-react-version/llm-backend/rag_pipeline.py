# RAG 管線，協調檢索和生成

from typing import List, Dict, Any
from knowledge_base import knowledge_base
import json

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
    
    def enhance_symptom_summary(self, original_text: str, symptoms: List[str] = None) -> str:
        """使用 RAG 增強症狀摘要"""
        try:
            # 檢索相關知識
            query = f"症狀：{', '.join(symptoms) if symptoms else original_text}"
            retrieved_docs = self.retrieve_relevant_knowledge(query, None, 2)  # 不限制類別
            
            # 格式化上下文
            context = self.format_context_for_llm(retrieved_docs)
            
            # 建構增強的 prompt
            enhanced_prompt = f"""
你是一位急診分級護理師助手。請根據以下資訊提供症狀分析：

{context}

原始主訴：{original_text}

請參考上述醫學知識，整理出主要症狀關鍵詞。
請特別注意：
- 體溫 >= 38°C 要識別為「發燒」
- 體溫 >= 39°C 要識別為「高燒」
- 體溫 >= 40°C 要識別為「超高熱」
- 血壓、心跳等異常也要識別為症狀

請嚴格使用頓號（、）分隔症狀，不要使用其他符號。
範例格式：胸痛、呼吸困難、發燒

請只回傳症狀關鍵詞，不要加任何解釋。
"""
            return enhanced_prompt
        except Exception as e:
            print(f"❌ RAG 增強失敗: {e}")
            # 失敗時回傳簡單 prompt
            return f"""
你是一位急診分級護理師助手。請從以下主訴中整理出症狀關鍵詞：

原始主訴：{original_text}

請特別注意：
- 體溫 >= 38°C 要識別為「發燒」
- 體溫 >= 39°C 要識別為「高燒」
- 體溫 >= 40°C 要識別為「超高熱」
- 血壓、心跳等異常也要識別為症狀

請嚴格使用頓號（、）分隔症狀，不要使用其他符號。
範例格式：胸痛、呼吸困難、發燒

請只回傳症狀關鍵詞，不要加任何解釋。
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