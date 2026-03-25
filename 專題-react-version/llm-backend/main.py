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


app = FastAPI()
def call_local_llm(prompt: str):
    try:
        url = "http://localhost:11434/api/generate"
        
        payload = {
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        }
        
        response = requests.post(url, json=payload, timeout=120)
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


class SummarizeResponse(BaseModel):
    summary: str


class RecommendSymptomsRequest(BaseModel):
    text: str
    symptom_candidates: list[str]
    max_results: int = 10
    llm_mode: str = "local"


class RecommendSymptomsResponse(BaseModel):
    recommended_symptoms: list[str]


@app.post("/api/summarize-chief-complaint", response_model=SummarizeResponse)
async def summarize_cc(body: SummarizeRequest):
    raw = body.text or ""

    try:
        # 使用 RAG 增強的 prompt
        llm_fn = call_gemini_llm if body.llm_mode == "cloud" else call_local_llm
        if body.llm_mode == "cloud":
            prompt = (
                "你是一位急診分級護理師的助手。請從以下原始主訴中，整理出主要症狀關鍵詞，"
                "使用頓號（、）分隔，例如：『頭痛、頭暈、胸悶』。"
                "只輸出症狀關鍵詞，不要加任何說明句子。\n\n"
                "原始主訴：" + raw + "\n\n症狀關鍵詞："
                )
        else:
            prompt = rag_pipeline.enhance_symptom_summary(raw)
        summary = llm_fn(prompt).strip()
        
        # 後處理：統一分隔符為頓號
        if summary:
            # 將各種分隔符統一為頓號
            summary = summary.replace('•', '、')  # 點點
            summary = summary.replace('·', '、')  # 中間點
            summary = summary.replace(',', '、')  # 逗號
            summary = summary.replace('，', '、')  # 全形逗號
            summary = summary.replace(' ', '')      # 移除空格
            # 移除重複的頓號
            while '、、' in summary:
                summary = summary.replace('、、', '、')
        
        # 若模型回傳空字串，退回原文作為保底
        if not summary:
            summary = raw
    except Exception as e:
        print("LLM error:", e)
        summary = raw

    return SummarizeResponse(summary=summary)
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

#     return SummarizeResponse(summary=summary)


@app.post("/api/recommend-symptoms", response_model=RecommendSymptomsResponse)
async def recommend_symptoms(body: RecommendSymptomsRequest):
    text = body.text or ""
    candidates = body.symptom_candidates or []
    max_results = body.max_results or 10

    if not candidates:
        return RecommendSymptomsResponse(recommended_symptoms=[])

    try:
       

        # 建立候選症狀清單（編號只是幫助理解，實際輸出仍以名稱為主）
        candidate_lines = "\n".join(f"- {name}" for name in candidates)

        prompt = (
            "你是一位熟悉台灣急診分級系統的護理師助手。"\
            "目前已經有一段整理過的主訴內容，請你從提供的『候選症狀清單』中，"\
            "選出最符合這段主訴的幾個症狀作為建議，不要發明清單裡沒有的症狀。"\
            "\n\n"\
            "主訴內容：" + text + "\n\n"\
            "候選症狀清單（只能從這些裡面選）：\n" + candidate_lines + "\n\n"\
            f"請你從候選清單中選出 1 到 {max_results} 個最適合的症狀。"\
            "如果候選清單裡沒有跟主訴明顯相關的症狀，請回傳空的 JSON 陣列 []，"\
            "不要勉強選一個不相干的診斷。"\
            "請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。範例：\n"\
            "[\"頭痛\", \"胸痛\"]"
        )

        llm_fn = call_gemini_llm if body.llm_mode == "cloud" else call_local_llm
        raw = llm_fn(prompt).strip()


        print("LLM recommend raw:", raw)

        recommended: list[str] = []
        data = None

        # 第一次嘗試：直接把整個回應當作 JSON 解析
        try:
            data = json.loads(raw)
        except Exception as parse_err:
            print("LLM recommend json.loads error:", parse_err)

        # 第二次嘗試：抓出第一組 [...] 再解析
        if data is None:
            start = raw.find("[")
            end = raw.rfind("]")
            if start != -1 and end != -1 and end > start:
                bracket_part = raw[start : end + 1]
                try:
                    data = json.loads(bracket_part)
                except Exception as parse_err2:
                    print("LLM recommend bracket parse error:", parse_err2, "bracket_part=", bracket_part)
        
        # 第三次嘗試：處理 Python set 格式 {"item1", "item2"}
        if data is None:
            # 尋找 { ... } 格式
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1 and end > start:
                set_part = raw[start : end + 1]
                try:
                    # 轉換 Python set 格式為 JSON 陣列
                    set_content = set_part[1:-1]  # 移除 { }
                    items = [item.strip().strip('"').strip("'") for item in set_content.split(",")]
                    # 過濾空項目
                    data = [item for item in items if item]
                except Exception as parse_err3:
                    print("LLM recommend set parse error:", parse_err3, "set_part=", set_part)
        
        # 第四次嘗試：處理純文字清單
        if data is None:
            # 如果回傳的是純文字，嘗試按行或逗號分割
            lines = raw.split('\n')
            items = []
            for line in lines:
                line = line.strip()
                # 移除編號和符號
                line = line.lstrip('0123456789.-* ')
                if line and line in candidates:
                    items.append(line)
            if items:
                data = items

        if isinstance(data, list):
            recommended = [str(x) for x in data]
        elif isinstance(data, dict) and "recommended_symptoms" in data:
            value = data.get("recommended_symptoms")
            if isinstance(value, list):
                recommended = [str(x) for x in value]

        # 僅保留在候選清單中的項目，並去重、限制數量
        candidate_set = set(candidates)
        filtered: list[str] = []
        for name in recommended:
            if name in candidate_set and name not in filtered:
                filtered.append(name)
            if len(filtered) >= max_results:
                break

        # 允許回傳空陣列，前端會在這種情況下退回關鍵字推薦，避免出現明顯不相干的 LLM 建議。
        return RecommendSymptomsResponse(recommended_symptoms=filtered)

    except Exception as e:
        print("LLM recommend error:", e)
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

