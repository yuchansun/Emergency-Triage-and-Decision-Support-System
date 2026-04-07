from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import requests
from database import fetch_all
from rag_pipeline import rag_pipeline
from knowledge_base import knowledge_base
#新加
from google import genai as genai_new
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    client = genai_new.Client(api_key=GEMINI_API_KEY)
    print("✅ Gemini API Key 載入成功")
else:
    client = None
    print("⚠️ 找不到 GEMINI_API_KEY，雲端模式無法使用")

from vitals_analyzer import vitals_analyzer

app = FastAPI()
def call_local_llm(prompt: str):
    try:
        url = "http://localhost:11434/api/generate"
        
        payload = {
            "model": "llama3",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,  # 稍微提高溫度增加靈活性
                "top_p": 0.8,        # 提高生成效率
                "max_tokens": 30,     # 進一步限制確保快速
                "num_predict": 30,    # 預測token數限制
                "repeat_penalty": 1.1  # 避免重複
            }
        }
        
        response = requests.post(url, json=payload, timeout=8)  # 稍微增加超時時間
        response.raise_for_status()
        
        result = response.json()
        return result.get("response", "")
    except requests.exceptions.RequestException as e:
        print(f"❌ 本地端LLM API 呼叫失敗: {e}")
        return ""
    except Exception as e:
        print(f"❌ 本地端LLM 處理失敗: {e}")
        return ""

def call_gemini_llm(prompt: str) -> str:
    try:
        if client is None:
            print("❌ Gemini client 未初始化")
            return ""
        
        response = client.models.generate_content(
            
            model="models/gemini-1.5-flash",
            contents=prompt
        )
        return response.text
    except Exception as e:
        print(f"❌ Gemini API 呼叫失敗: {e}")
        return ""
    

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 開發階段先全開，之後可以收緊
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class SummarizeRequest(BaseModel):
    text: str
    llm_mode: str = "local"
    vitals: dict = None


class SummarizeResponse(BaseModel):
    summary: str


class RecommendSymptomsRequest(BaseModel):
    text: str
    symptom_candidates: list[str]
    max_results: int = 10
    llm_mode: str = "local"
    vitals: dict = None


class RecommendSymptomsResponse(BaseModel):
    recommended_symptoms: list[str]


@app.post("/api/summarize-chief-complaint", response_model=SummarizeResponse)
async def summarize_cc(body: SummarizeRequest):
    try:
        # 先獲取輸入參數
        raw = body.text.strip()
        vitals = body.vitals
        llm_mode = getattr(body, 'llm_mode', 'local')
        
        # 使用 RAG 增強的 prompt
        llm_fn = call_gemini_llm if llm_mode == "cloud" else call_local_llm
        if llm_mode == "cloud":
            prompt = (
                "你是一位急診分級護理師的助手。請從以下原始主訴中，整理出主要症狀關鍵詞，"
                "使用頓號（、）分隔，例如：『頭痛、頭暈、胸悶』。"
                "只輸出症狀關鍵詞，不要加任何說明句子。\n\n"
                "原始主訴：" + raw + "\n\n症狀關鍵詞："
                )
        else:
            prompt = rag_pipeline.enhance_symptom_summary(raw)
        summary = llm_fn(prompt).strip()
        
        # 分析生命徵象異常
        vitals_symptoms = []
        if vitals:
            vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
        
        # 如果沒有文字輸入但有生命徵象異常，直接使用生命徵象分析結果
        if not raw and vitals_symptoms:
            summary = "、".join(vitals_symptoms)
            print(f"[LLM] 純生命徵象輸入，快速返回：{summary}")
            return SummarizeResponse(summary=summary)
        
        # 如果有文字輸入也有生命徵象異常，簡化處理
        if raw and vitals_symptoms:
            print(f"[LLM] 處理混合輸入：'{raw}' + 生命徵象")
            
            # 先用LLM統整語音內容
            voice_prompt = f"""
你是一位急診分級護理師助手。請從以下主訴中整理出主要症狀關鍵詞：

原始主訴：{raw}

請嚴格使用頓號（、）分隔症狀，不要使用其他符號。
範例格式：頭痛、胸悶、胸痛

請只回傳症狀關鍵詞，不要加任何解釋。
"""
            
            voice_summary = ""
            try:
                voice_summary = call_local_llm(voice_prompt).strip()
                print(f"[LLM] 語音統整原始結果：'{voice_summary}'")
                
                # 檢查LLM結果是否有效
                if not voice_summary or len(voice_summary) == 0:
                    print("[LLM] 語音統整返回空結果，使用原始內容")
                    voice_summary = ""
                elif voice_summary == raw:
                    print("[LLM] 語音統整返回原文，嘗試重新整理")
                    # 如果返回原文，嘗試簡單處理
                    if "我覺得" in voice_summary:
                        voice_summary = voice_summary.replace("我覺得", "")
                    if "我" in voice_summary:
                        voice_summary = voice_summary.replace("我", "")
                    voice_summary = voice_summary.strip()
                    print(f"[LLM] 簡單處理後：'{voice_summary}'")
                
            except Exception as e:
                print(f"[LLM] 語音統整失敗：{e}")
                voice_summary = ""
            
            # 決定使用哪個語音內容
            if voice_summary and len(voice_summary) > 0:
                print(f"[LLM] 使用LLM統整的語音：{voice_summary}")
                existing_symptoms = [symptom.strip() for symptom in voice_summary.split("、") if symptom.strip()]
            else:
                print(f"[LLM] 語音統整失敗，使用原始內容：{raw}")
                existing_symptoms = [symptom.strip() for symptom in raw.split("、") if symptom.strip()]
            
            # 添加生命徵象症狀，避免重複
            for vital_symptom in vitals_symptoms:
                if vital_symptom not in existing_symptoms:
                    existing_symptoms.append(vital_symptom)
            
            summary = "、".join(existing_symptoms)
            print(f"[LLM] 最終合併結果：{summary}")
            return SummarizeResponse(summary=summary)
        
        # 正常的 LLM 處理流程（只有文字輸入或沒有生命徵象異常）
        print(f"[LLM] 使用 LLM 處理：'{raw}'")
        enhanced_prompt = rag_pipeline.enhance_symptom_summary(raw, vitals=vitals)
        response = call_local_llm(enhanced_prompt).strip()
        
        # 清理回應，確保格式正確
        if response and len(response) > 0:
            summary = response
        else:
            summary = raw
            
        return SummarizeResponse(summary=summary)
    except Exception as e:
        print("Summarize error:", e)
        return SummarizeResponse(summary=body.text)
# @app.post("/api/summarize-chief-complaint", response_model=SummarizeResponse)
# async def summarize_cc(body: SummarizeRequest):
#     raw = body.text or ""

#     try:
        
#         prompt = (
#             "你是一位急診分級護理師的助手。現在有一段由病患或家屬口述的原始主訴，"
#             "內容可能冗長、重複或不夠有結構。請你從這段原始主訴中，整理出『主要症狀關鍵詞』，"
#             "例如：頭痛、頭暈、全身不適、發燒、胸痛、噁心嘔吐等。"
#             "請只輸出症狀關鍵詞本身，使用頓號（、）分隔，例如：『頭痛、頭暈、全身不適』，"
#             "不要加上『患者主訴』或任何其他說明句子，也不要加入時間、原因或推論。"
#             "若原始主訴中沒有明確症狀，則盡量從語意中推測一到兩個最可能的症狀關鍵詞即可。\n\n"
#             "嚴禁回傳原始內容或其長句，即使你不確定。\n"
#             "原始主訴：" + raw + "\n\n症狀關鍵詞："
#         )
#         summary = call_local_llm(prompt).strip()

#         # 若模型回傳空字串，退回原文作為保底，避免前端出現空白主訴。
#         if not summary:
#             summary = raw
#     except Exception as e:
#         print("LLM error:", e)
#         # 出錯時無法取得真正摘要，退回原文作為保底。
#         summary = raw


@app.post("/api/recommend-symptoms", response_model=RecommendSymptomsResponse)
async def recommend_symptoms(body: RecommendSymptomsRequest):
    try:
        text = body.text.strip()
        candidates = body.symptom_candidates
        max_results = min(body.max_results, 5)  # 限制最多5個推薦
        vitals = body.vitals
        
        print(f"[LLM] 開始推薦症狀，主訴：{text}，候選數量：{len(candidates)}")
        
        # 分析生命徵象異常
        vitals_symptoms = []
        if vitals:
            vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
            print(f"[LLM] 生命徵象分析：{vitals_symptoms}")
        
        # 使用RAG檢索相關醫學知識
        relevant_knowledge = []
        if text:
            try:
                # 根據主訴檢索相關知識
                relevant_knowledge = rag_pipeline.retrieve_relevant_knowledge(
                    query=text, 
                    category=None, 
                    n_results=3
                )
                print(f"[LLM] 檢索到 {len(relevant_knowledge)} 條相關知識")
            except Exception as e:
                print(f"[LLM] RAG檢索失敗: {e}")
        
        # 如果是純生命徵象輸入（沒有文字），使用直接的症狀映射
        if not text and vitals_symptoms:
            # 建立生命徵象症狀到症狀庫的映射
            vitals_to_symptoms_mapping = {
                "發燒": ["發燒", "體溫過高", "發熱"],
                "高燒": ["高燒", "體溫過高", "發熱", "發燒"],
                "超高熱": ["超高熱", "體溫過高", "發熱", "高燒", "發燒"],
                "輕度高血壓": ["輕度高血壓", "高血壓", "血壓過高"],
                "重度高血壓": ["重度高血壓", "高血壓", "血壓過高", "嚴重高血壓"],
                "嚴重高血壓": ["嚴重高血壓", "高血壓", "血壓過高", "重度高血壓"],
                "舒張期高血壓": ["舒張期高血壓", "高血壓", "血壓過高"],
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
                    if symptom in candidates:
                        matched_symptoms.append(symptom)
                        break
            
            print(f"[LLM] 純生命徵象推薦：{vitals_symptoms} → {matched_symptoms}")
            return RecommendSymptomsResponse(recommended_symptoms=matched_symptoms[:max_results])
        
        # 如果有文字輸入，使用RAG增強的推薦
        if text:
            # 格式化檢索到的知識
            context = ""
            if relevant_knowledge:
                context = rag_pipeline.format_context_for_llm(relevant_knowledge)
                print(f"[LLM] 使用RAG上下文：{context[:200]}...")
            
            # 建立候選症狀清單
            candidate_lines = "\n".join(f"- {name}" for name in candidates)
            
            # 建構包含RAG知識的提示
            prompt = (
                "你是一位熟悉台灣急診分級系統的專業護理師。"
                "請根據以下資訊，從候選症狀清單中推薦最相關的症狀。\n\n"
                f"患者主訴：{text}\n"
            )
            
            # 添加生命徵象信息
            if vitals_symptoms:
                prompt += f"生命徵象異常：{', '.join(vitals_symptoms)}\n"
            
            # 添加RAG檢索的醫學知識
            if context:
                prompt += f"\n相關醫學知識：\n{context}\n"
            
            prompt += (
                f"\n候選症狀清單（只能從這些裡面選）：\n{candidate_lines}\n\n"
                f"請從候選清單中選出 1 到 {max_results} 個最相關且重要的症狀。"
                "考慮以下原則：\n"
                "1. 症狀必須與主訴高度相關\n"
                "2. 優先考慮緊急或危險的症狀\n"
                "3. 避免推薦不相關或重複的症狀\n"
                "4. 如果候選清單中沒有明顯相關的症狀，請回傳空陣列 []\n\n"
                "請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。範例：\n"
                "[\"頭痛\", \"胸痛\"]"
            )
            
            llm_fn = call_gemini_llm if body.llm_mode == "cloud" else call_local_llm
            raw = llm_fn(prompt).strip()
            
            print(f"[LLM] RAG增強推薦原始回應：{raw}")
            
            # 解析LLM回應
            try:
                recommended = json.loads(raw)
                if isinstance(recommended, list):
                    # 過濾確保都在候選清單中
                    filtered_recommendations = [
                        symptom for symptom in recommended 
                        if symptom in candidates
                    ]
                    print(f"[LLM] RAG增強推薦結果：{filtered_recommendations}")
                    return RecommendSymptomsResponse(recommended_symptoms=filtered_recommendations[:max_results])
            except json.JSONDecodeError:
                print(f"[LLM] JSON解析失敗，回應：{raw}")
            
            # 如果RAG增強失敗，回退到傳統方法
            print("[LLM] RAG增強失敗，使用傳統推薦方法")
        
        # 傳統推薦方法（作為備選）
        candidate_lines = "\n".join(f"- {name}" for name in candidates)
        
        prompt = (
            "你是一位熟悉台灣急診分級系統的護理師助手。"
            "目前已經有一段整理過的主訴內容，請你從提供的『候選症狀清單』中，"
            "選出最符合這段主訴的幾個症狀作為建議，不要發明清單裡沒有的症狀。\n\n"
            f"主訴內容：{text}\n\n"
            f"候選症狀清單（只能從這些裡面選）：\n{candidate_lines}\n\n"
            f"請你從候選清單中選出 1 到 {max_results} 個最適合的症狀。"
            "如果候選清單裡沒有跟主訴明顯相關的症狀，請回傳空的 JSON 陣列 []，"
            "不要勉強選一個不相干的診斷。"
            "請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。範例：\n"
            "[\"頭痛\", \"胸痛\"]"
        )
        
        llm_fn = call_gemini_llm if body.llm_mode == "cloud" else call_local_llm
        raw = llm_fn(prompt).strip()
        
        print(f"[LLM] 傳統推薦原始回應：{raw}")
        
        # 解析傳統方法的回應
        try:
            recommended = json.loads(raw)
            if isinstance(recommended, list):
                filtered_recommendations = [
                    symptom for symptom in recommended 
                    if symptom in candidates
                ]
                print(f"[LLM] 傳統推薦結果：{filtered_recommendations}")
                return RecommendSymptomsResponse(recommended_symptoms=filtered_recommendations[:max_results])
        except json.JSONDecodeError:
            print(f"[LLM] 傳統方法JSON解析失敗，回應：{raw}")
        
        # 如果所有方法都失敗，返回空陣列
        print("[LLM] 所有推薦方法都失敗，返回空陣列")
        return RecommendSymptomsResponse(recommended_symptoms=[])
        
    except Exception as e:
        print(f"❌ 推薦症狀時發生錯誤: {e}")
        return RecommendSymptomsResponse(recommended_symptoms=[])

# 新增一個 API，用來抓取那 5 個隨機病患 (誒這是啥呀)
@app.get("/api/patients")
async def get_patients():
    query = "SELECT patient_id, name, id_number, birth_date, medical_number, gender FROM patients"
    patients = fetch_all(query)
    
    if not patients:
        return {"message": "目前沒有病患資料或連線失敗"}
            
    return patients

# 初始化知識庫（只在啟動時執行一次）
@app.on_event("startup")
async def startup_event():
    print("🚀 初始化 RAG 知識庫...")
    knowledge_base.initialize_knowledge_base()

class RAGSearchRequest(BaseModel):
    query: str
    category: str = None
    n_results: int = 5

class RAGSearchResponse(BaseModel):
    results: list[dict]

@app.post("/api/rag-search", response_model=RAGSearchResponse)
async def rag_search(body: RAGSearchRequest):
    """RAG 知識搜尋 API"""
    try:
        results = rag_pipeline.retrieve_relevant_knowledge(
            body.query, 
            body.category, 
            body.n_results
        )
        return RAGSearchResponse(results=results)
    except Exception as e:
        print("RAG search error:", e)
        return RAGSearchResponse(results=[])

class TriageAdviceRequest(BaseModel):
    symptoms: list[str]
    vitals: dict = None

class TriageAdviceResponse(BaseModel):
    advice: str

@app.post("/api/triage-advice", response_model=TriageAdviceResponse)
async def triage_advice(body: TriageAdviceRequest):
    """RAG 增強檢傷建議 API"""
    try:
        enhanced_prompt = rag_pipeline.enhance_triage_recommendation(
            body.symptoms, 
            body.vitals
        )
        advice = call_local_llm(enhanced_prompt).strip()
        return TriageAdviceResponse(advice=advice)
    except Exception as e:
        print("Triage advice error:", e)
        return TriageAdviceResponse(advice="系統暫時無法提供建議")

