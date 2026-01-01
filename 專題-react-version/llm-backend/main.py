from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 開發階段先全開，之後可以收緊
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gemini_api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None


class SummarizeRequest(BaseModel):
    text: str


class SummarizeResponse(BaseModel):
    summary: str


class RecommendSymptomsRequest(BaseModel):
    text: str
    symptom_candidates: list[str]
    max_results: int = 10


class RecommendSymptomsResponse(BaseModel):
    recommended_symptoms: list[str]


@app.post("/api/summarize-chief-complaint", response_model=SummarizeResponse)
async def summarize_cc(body: SummarizeRequest):
    raw = body.text or ""

    try:
        if not client:
            raise RuntimeError("GEMINI_API_KEY is not set")
        prompt = (
            "你是一位急診分級護理師的助手。現在有一段由病患或家屬口述的原始主訴，"
            "內容可能冗長、重複或不夠有結構。請你從這段原始主訴中，整理出『主要症狀關鍵詞』，"
            "例如：頭痛、頭暈、全身不適、發燒、胸痛、噁心嘔吐等。"
            "請只輸出症狀關鍵詞本身，使用頓號（、）分隔，例如：『頭痛、頭暈、全身不適』，"
            "不要加上『患者主訴』或任何其他說明句子，也不要加入時間、原因或推論。"
            "若原始主訴中沒有明確症狀，則盡量從語意中推測一到兩個最可能的症狀關鍵詞即可。\n\n"
            "嚴禁回傳原始內容或其長句，即使你不確定。\n"
            "原始主訴：" + raw + "\n\n症狀關鍵詞："
        )
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        summary = (resp.text or "").strip()

        # 若模型回傳空字串，退回原文作為保底，避免前端出現空白主訴。
        if not summary:
            summary = raw
    except Exception as e:
        print("LLM error:", e)
        # 出錯時無法取得真正摘要，退回原文作為保底。
        summary = raw

    return SummarizeResponse(summary=summary)


@app.post("/api/recommend-symptoms", response_model=RecommendSymptomsResponse)
async def recommend_symptoms(body: RecommendSymptomsRequest):
    text = body.text or ""
    candidates = body.symptom_candidates or []
    max_results = body.max_results or 10

    if not candidates:
        return RecommendSymptomsResponse(recommended_symptoms=[])

    try:
        if not client:
            raise RuntimeError("GEMINI_API_KEY is not set")

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
            "請只輸出 JSON 陣列，不要加任何多餘說明。範例：\n"\
            "[\"頭痛\", \"胸痛\"]"
        )

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw = (resp.text or "").strip()
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