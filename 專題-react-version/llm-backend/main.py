from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from google import genai
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
            print("LLM empty:", e)
            summary = raw
    except Exception as e:
        print("LLM error:", e)
        # 出錯時無法取得真正摘要，退回原文作為保底。
        summary = raw

    return SummarizeResponse(summary=summary)