from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import re
import time
import requests
from collections import defaultdict
from database import fetch_all
from rag_pipeline import (
    CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES,
    rag_pipeline,
    compute_final_ttas_degree,
    format_advice_with_rule_layer,
)
from knowledge_base import knowledge_base
#新加
from google import genai as genai_new
from dotenv import load_dotenv

try:
    import opencc
except ImportError:
    opencc = None

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Gemini 模型也可由環境變數切換，例如想升級 gemini-2.0-flash 時不用動程式碼
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-1.5-flash")
if GEMINI_API_KEY:
    client = genai_new.Client(api_key=GEMINI_API_KEY)
    print(f"✅ Gemini API Key 載入成功（model={GEMINI_MODEL}）")
else:
    client = None
    print("⚠️ 找不到 GEMINI_API_KEY，雲端模式無法使用")

# 本地端 Ollama 模型可由環境變數切換；開發用 7B、Demo/驗收時可改 14B。
# 預設為 qwen2.5:7b-instruct（繁中表現遠優於 llama3）；
# 若要切回舊模型或升 14B，在 .env 設 OLLAMA_MODEL 即可，不需動程式碼。
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
try:
    OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "200"))
except (TypeError, ValueError):
    OLLAMA_NUM_PREDICT = 200
try:
    OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "30"))
except (TypeError, ValueError):
    OLLAMA_TIMEOUT = 30
print(
    "✅ Ollama 設定："
    f"base_url={OLLAMA_BASE_URL}, model={OLLAMA_MODEL}, "
    f"num_predict={OLLAMA_NUM_PREDICT}, timeout={OLLAMA_TIMEOUT}s"
)

from vitals_analyzer import match_vital_labels_to_symptom_candidates, vitals_analyzer

app = FastAPI()

_TW_CONVERTER = None
if opencc is not None:
    try:
        # s2twp: 簡中 -> 台灣繁中詞彙（例：头痛 -> 頭痛，软件 -> 軟體）
        _TW_CONVERTER = opencc.OpenCC("s2twp")
        print("✅ OpenCC 台灣繁中轉換器已啟用")
    except Exception as e:
        print(f"⚠️ OpenCC 初始化失敗，將只依賴 LLM prompt 控制繁中輸出：{e}")
else:
    print("⚠️ 找不到 opencc 套件，將只依賴 LLM prompt 控制繁中輸出")


def to_taiwan_traditional(text: str) -> str:
    """將 LLM 輸出正規化為台灣繁中，避免本地模型偶爾吐出簡體字。"""
    if not isinstance(text, str) or not text:
        return text or ""
    if _TW_CONVERTER is None:
        return text
    try:
        return _TW_CONVERTER.convert(text)
    except Exception as e:
        print(f"⚠️ OpenCC 轉換失敗，保留原文：{e}")
        return text


def _normalize_symptom_token(s: str) -> str:
    """正規化症狀字串以利去重：移除前後空白、全形/半形空白、零寬字元。"""
    if not isinstance(s, str):
        return ""
    return (
        s.replace("\u3000", "")
         .replace("\u200b", "")
         .replace(" ", "")
         .strip()
    )


def _is_subsumed(a: str, b: str) -> bool:
    """判斷 a 與 b 是否屬同一概念：兩者去空白後互為子字串即視為重複。

    例：「嚴重意識障」 vs 「嚴重意識障礙」 → True（前者為後者的前綴）。
    例：「血糖高」 vs 「高血糖」 → False（彼此皆非子字串，這類同義詞屬於 Phase 2 才處理）。
    """
    na = _normalize_symptom_token(a)
    nb = _normalize_symptom_token(b)
    if not na or not nb:
        return False
    return na in nb or nb in na


def _merge_symptom_lists_preserve_order(*symptom_lists: list[str]) -> list[str]:
    """依序合併多個症狀清單，遇到「被涵蓋的同概念」自動去重；較完整的詞會取代較短的詞。

    保留輸入順序，避免後加入的生命徵象標籤把原本主訴語意洗掉。
    """
    merged: list[str] = []
    for symptom_list in symptom_lists:
        if not symptom_list:
            continue
        for sym in symptom_list:
            if not isinstance(sym, str):
                continue
            sym_clean = sym.strip()
            if not sym_clean:
                continue
            replaced = False
            duplicate = False
            for i, kept in enumerate(merged):
                if _is_subsumed(sym_clean, kept):
                    # 同概念，留下較長的版本（通常較完整、較貼近 TTAS 標準術語）
                    if len(_normalize_symptom_token(sym_clean)) > len(
                        _normalize_symptom_token(kept)
                    ):
                        merged[i] = sym_clean
                        replaced = True
                    duplicate = True
                    break
            if not duplicate and not replaced:
                merged.append(sym_clean)
    return merged

# 本地模式：打 Ollama（速度快、離線可用）
# 主機位置、模型與輸出長度由 OLLAMA_BASE_URL / OLLAMA_MODEL / OLLAMA_NUM_PREDICT 控制。
def call_local_llm(prompt: str):
    start = time.perf_counter()
    try:
        url = f"{OLLAMA_BASE_URL}/api/generate"

        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "top_p": 0.8,
                # 預留足夠 token 給繁中輸出（llama 系列 tokenizer 對中文不友善，
                # 一個中文字常佔 2~3 tokens；過低會把詞砍斷成「嚴重意識障」這種怪詞）。
                "num_predict": OLLAMA_NUM_PREDICT,
                "repeat_penalty": 1.1,
            },
        }

        response = requests.post(url, json=payload, timeout=OLLAMA_TIMEOUT)
        response.raise_for_status()

        result = response.json()
        elapsed = time.perf_counter() - start
        # 推理耗時 log，方便比較不同模型（llama3 vs qwen2.5:7b vs qwen2.5:14b）的速度差異
        print(f"[Ollama] model={OLLAMA_MODEL} elapsed={elapsed:.2f}s prompt_chars={len(prompt)}")
        return to_taiwan_traditional(result.get("response", ""))
    except requests.exceptions.RequestException as e:
        elapsed = time.perf_counter() - start
        print(f"❌ 本地端LLM API 呼叫失敗（耗時 {elapsed:.2f}s）: {e}")
        return ""
    except Exception as e:
        elapsed = time.perf_counter() - start
        print(f"❌ 本地端LLM 處理失敗（耗時 {elapsed:.2f}s）: {e}")
        return ""

# 雲端模式：打 Gemini（品質通常較穩，但要有 API Key）
def call_gemini_llm(prompt: str) -> str:
    try:
        if client is None:
            print("❌ Gemini client 未初始化")
            return ""
        
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        return to_taiwan_traditional(response.text)
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
    # 這支 API 的目標：把自由輸入主訴整理成「症狀關鍵詞」字串
    try:
        # 先獲取輸入參數
        raw = body.text.strip()
        vitals = body.vitals
        llm_mode = getattr(body, 'llm_mode', 'local')
        llm_fn = call_gemini_llm if llm_mode == "cloud" else call_local_llm

        # 先把生命徵象轉成症狀標籤（例如：發燒、低血氧）
        vitals_symptoms = []
        if vitals:
            vitals_symptoms, _ = vitals_analyzer.analyze_vitals(vitals)
        
        # 如果沒有文字輸入但有生命徵象異常，直接使用生命徵象分析結果
        if not raw and vitals_symptoms:
            summary = to_taiwan_traditional("、".join(vitals_symptoms))
            print(f"[LLM] 純生命徵象輸入，快速返回：{summary}")
            return SummarizeResponse(summary=summary)
        
        # 文字 + 生命徵象同時存在時，先整理文字，再把 vitals 症狀補進去
        if raw and vitals_symptoms:
            print(f"[LLM] 處理混合輸入：'{raw}' + 生命徵象")
            
            # 先用LLM統整語音內容
            voice_prompt = f"""
你是一位急診分級護理師助手。請從以下主訴中整理出主要症狀關鍵詞：

原始主訴：{raw}

{CHIEF_COMPLAINT_SYMPTOM_KEYWORDS_RULES}
請嚴格使用頓號（、）分隔症狀。
範例格式：頭痛、胸悶

請只回傳症狀關鍵詞，不要加任何解釋。
"""
            
            voice_summary = ""
            try:
                voice_summary = llm_fn(voice_prompt).strip()
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

            # 合併 LLM 整理結果 + 生命徵象標籤；用包含關係去重，並保留較完整的詞。
            # 例：LLM 截斷的「嚴重意識障」與規則層的「嚴重意識障礙」會合併為後者，不再並存。
            merged_symptoms = _merge_symptom_lists_preserve_order(existing_symptoms, vitals_symptoms)

            summary = to_taiwan_traditional("、".join(merged_symptoms))
            print(f"[LLM] 最終合併結果：{summary}")
            return SummarizeResponse(summary=summary)
        
        # 一般流程：走 RAG 增強 prompt 後再請 LLM 摘要
        print(f"[LLM] 使用 LLM 處理：'{raw}'（mode={llm_mode}）")
        enhanced_prompt = rag_pipeline.enhance_symptom_summary(raw, vitals=vitals)
        summary = to_taiwan_traditional(llm_fn(enhanced_prompt).strip() or raw)

        return SummarizeResponse(summary=summary)
    except Exception as e:
        print("Summarize error:", e)
        return SummarizeResponse(summary=to_taiwan_traditional(body.text))
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
    # 從前端提供的候選症狀中，選出最相關的 1~5 個（不允許發明新症狀）
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
        
        # 先檢索背景知識，後面組 prompt 會放進去當上下文
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
        # match_vital_labels_to_symptom_candidates 內部會先查字典，未命中時走語意檢索
        if not text and vitals_symptoms:
            matched_symptoms = match_vital_labels_to_symptom_candidates(
                vitals_symptoms, candidates
            )
            print(f"[LLM] 純生命徵象推薦：{vitals_symptoms} → {matched_symptoms}")
            return RecommendSymptomsResponse(recommended_symptoms=matched_symptoms[:max_results])

        # 主訴有文字時，優先走 RAG 增強推薦
        if text:
            # 格式化檢索到的知識
            context = ""
            if relevant_knowledge:
                context = rag_pipeline.format_context_for_llm(relevant_knowledge)
                print(f"[LLM] 使用RAG上下文：{context[:200]}...")

            # Phase 1：用語意檢索把全候選縮到 LLM 容易處理的範圍。
            # 同時把 vitals 標籤併入 query，讓 GCS=8 → 嚴重意識障礙 → 意識程度改變 這條路打通。
            semantic_query = text
            if vitals_symptoms:
                semantic_query = f"{text}；生命徵象異常：{', '.join(vitals_symptoms)}"
            narrowed_candidates = rag_pipeline.find_similar_symptoms(
                query=semantic_query,
                candidates=candidates,
                top_k=40,
            )
            if narrowed_candidates:
                print(f"[LLM] 語意縮減候選 {len(candidates)} → {len(narrowed_candidates)}，前 10：{narrowed_candidates[:10]}")
            else:
                # 萬一語意檢索失敗，仍維持原本全量候選給 LLM
                narrowed_candidates = candidates
                print("[LLM] 語意縮減失敗，回退使用前端全候選")

            # 建立候選症狀清單（縮減後）
            candidate_lines = "\n".join(f"- {name}" for name in narrowed_candidates)
            
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
                "2. 不要僅因『可能嚴重』就推論危急症狀；無明確線索時勿過度升級\n"
                "3. 避免推薦不相關或重複的症狀\n"
                "4. 如果候選清單中沒有明顯相關的症狀，請回傳空陣列 []\n\n"
                "請嚴格只輸出 JSON 陣列格式，不要加任何解釋文字。範例：\n"
                "[\"頭痛\", \"胸痛\"]"
            )
            
            llm_fn = call_gemini_llm if body.llm_mode == "cloud" else call_local_llm
            raw = llm_fn(prompt).strip()
            
            print(f"[LLM] RAG增強推薦原始回應：{raw}")
            
            # 模型必須回 JSON 陣列，這裡做解析與白名單過濾
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
            
            # JSON 不合法或輸出怪異時，回退到較簡單的 prompt
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
    """RAG 知識搜尋 API（主要給測試/除錯用）"""
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

class RecommendRulesRequest(BaseModel):
    selected_symptoms: list[str]
    chief_complaint: str = ""
    vitals: dict = None
    llm_mode: str = "local"

class RecommendRulesResponse(BaseModel):
    recommended_rules: list[dict]

@app.post("/api/triage-advice", response_model=TriageAdviceResponse)
async def triage_advice(body: TriageAdviceRequest):
    """RAG（LangChain Retriever）+ LLM 說明 + 規則層決定分級；LLM 輸出不可單獨作為最終級別。"""
    try:
        retrieved = rag_pipeline.retrieve_relevant_knowledge(
            f"症狀：{', '.join(body.symptoms)}",
            None,
            8,
        )
        enhanced_prompt = rag_pipeline.enhance_triage_recommendation(
            body.symptoms,
            body.vitals,
            n_docs=8,
            pre_retrieved=retrieved,
        )
        llm_text = call_local_llm(enhanced_prompt).strip()
        final_deg, rationale = compute_final_ttas_degree(
            body.symptoms,
            body.vitals,
            retrieved,
        )
        advice = format_advice_with_rule_layer(llm_text, final_deg, rationale)
        return TriageAdviceResponse(advice=advice)
    except Exception as e:
        print("Triage advice error:", e)
        return TriageAdviceResponse(advice="系統暫時無法提供建議")

@app.post("/api/recommend-rules", response_model=RecommendRulesResponse)
async def recommend_rules(body: RecommendRulesRequest):
    """依已選症狀 + 已填生命徵象 + RAG 推薦判斷規則"""
    # 這支 API 是「候選規則內重排」，不是讓 LLM 自由生成規則
    try:
        selected_symptoms = [s.strip() for s in body.selected_symptoms if isinstance(s, str) and s.strip()]
        chief_complaint = str(body.chief_complaint or "").strip()
        vitals = body.vitals or {}
        llm_mode = body.llm_mode
        if not selected_symptoms:
            return RecommendRulesResponse(recommended_rules=[])

        query = """
        SELECT DISTINCT symptom_name, rule_code, judge_name, ttas_degree
        FROM triage_hierarchy
        WHERE symptom_name IS NOT NULL
          AND rule_code IS NOT NULL
          AND judge_name IS NOT NULL
        ORDER BY symptom_name, ttas_degree
        """
        all_rules = fetch_all(query)
        if not all_rules:
            return RecommendRulesResponse(recommended_rules=[])

        symptom_rules_map = {}
        for rule in all_rules:
            symptom = rule["symptom_name"]
            symptom_rules_map.setdefault(symptom, []).append({
                "rule_code": rule["rule_code"],
                "judge_name": rule["judge_name"],
                "ttas_degree": int(rule["ttas_degree"]),
            })

        # 未填的生命徵象直接忽略，避免把空值當正常值/異常值
        filled_vitals = {}
        for k, v in vitals.items():
            if isinstance(v, str):
                if v.strip() != "":
                    filled_vitals[k] = v.strip()
            elif v is not None:
                filled_vitals[k] = v

        # 候選症狀僅使用「已選症狀」，避免未選症狀出現在規則推薦中
        def extract_terms(text: str) -> list[str]:
            if not text:
                return []
            return [
                t for t in re.split(r"[\s,，、。；;：:/\\|()\[\]{}]+", text)
                if len(t.strip()) >= 2
            ]

        complaint_terms = extract_terms(chief_complaint)
        candidate_symptoms = list(dict.fromkeys(selected_symptoms))
        if not any(symptom_rules_map.get(s) for s in candidate_symptoms):
            return RecommendRulesResponse(recommended_rules=[])

        # 後面規則比對要做數值判斷，先安全地轉型
        temp_val = None
        spo2_val = None
        bs_val = None
        sbp_val = None
        dbp_val = None
        gcs_total = None
        try:
            if "temperature" in filled_vitals:
                temp_val = float(filled_vitals["temperature"])
        except Exception:
            temp_val = None
        try:
            if "spo2" in filled_vitals:
                spo2_val = float(filled_vitals["spo2"])
        except Exception:
            spo2_val = None
        try:
            if "bloodSugar" in filled_vitals:
                bs_val = float(filled_vitals["bloodSugar"])
        except Exception:
            bs_val = None
        try:
            if "systolicBP" in filled_vitals:
                sbp_val = float(filled_vitals["systolicBP"])
            if "diastolicBP" in filled_vitals:
                dbp_val = float(filled_vitals["diastolicBP"])
        except Exception:
            sbp_val = None
            dbp_val = None
        try:
            if all(k in filled_vitals for k in ["gcsEye", "gcsVerbal", "gcsMotor"]):
                gcs_total = int(filled_vitals["gcsEye"]) + int(filled_vitals["gcsVerbal"]) + int(filled_vitals["gcsMotor"])
        except Exception:
            gcs_total = None

        def vitals_rule_score(judge_name: str) -> int:
            """
            依生命徵象給規則評分；若明顯矛盾回傳極低分（過濾）。
            """
            j = str(judge_name or "")
            score = 0

            # SpO2 規則一致性
            if spo2_val is not None:
                if "<90%" in j:
                    if spo2_val < 90:
                        score += 45
                    else:
                        return -999
                if "<92%" in j:
                    if spo2_val < 92:
                        score += 35
                    else:
                        return -999
                if "92-94%" in j or "92-94" in j:
                    if 92 <= spo2_val <= 94:
                        score += 25
                    else:
                        score -= 12
                if "血氧" in j and spo2_val >= 95:
                    score -= 10

            # GCS 規則一致性
            if gcs_total is not None:
                if "GCS3-8" in j:
                    if 3 <= gcs_total <= 8:
                        score += 45
                    else:
                        return -999
                if "GCS9-13" in j:
                    if 9 <= gcs_total <= 13:
                        score += 35
                    else:
                        return -999
                if "GCS14-15" in j:
                    if 14 <= gcs_total <= 15:
                        score += 20
                    else:
                        score -= 8

            # 體溫規則一致性
            if temp_val is not None:
                if "高燒" in j:
                    if temp_val >= 39:
                        score += 28
                    else:
                        return -999
                if "發燒" in j and "高燒" not in j:
                    if temp_val >= 38:
                        score += 18
                    else:
                        return -999

            # 血糖規則一致性
            if bs_val is not None:
                if "低血糖" in j:
                    if bs_val < 70:
                        score += 26
                    else:
                        return -999
                if "高血糖" in j:
                    if bs_val > 140:
                        score += 20
                    else:
                        score -= 10

            # 血壓規則一致性（沒有明確閾值文字時以關鍵字加權）
            if sbp_val is not None or dbp_val is not None:
                has_hypertension = ((sbp_val is not None and sbp_val >= 140) or (dbp_val is not None and dbp_val >= 90))
                if "高血壓" in j or "血壓" in j:
                    if has_hypertension:
                        score += 20
                    else:
                        score -= 12

            return score

        # 每個症狀各推薦 2～3 條（預設 K=3），醫學情境下提高命中機率
        RULES_TOP_K_PER_SYMPTOM = 3
        RULES_POOL_PER_SYMPTOM = 12

        def rule_row(symptom: str, item: dict) -> dict:
            return {
                "rule_code": item["rule_code"],
                "symptom_name": symptom,
                "judge_name": item["judge_name"],
                "ttas_degree": int(item["ttas_degree"]),
            }

        def _rule_display_fingerprint(r: dict) -> tuple:
            """同一症狀下若多個 rule_code 對應相同級別+判斷文字，畫面會重複；用此指紋去重。"""
            return (int(r["ttas_degree"]), (r.get("judge_name") or "").strip())

        def complaint_rule_score(symptom: str, judge_name: str) -> int:
            if not complaint_terms:
                return 0
            score = 0
            if any(term in symptom for term in complaint_terms):
                score += 12
            if any(term in str(judge_name or "") for term in complaint_terms):
                score += 8
            return score

        def scored_list_for_symptom(symptom: str):
            # 同一 (級別, 判斷文字) 只保留分數最高的一筆（避免 DB 重複列造成兩顆相同按鈕）
            best_by_fp: dict = {}
            for item in symptom_rules_map.get(symptom, []):
                r = rule_row(symptom, item)
                vital_score = vitals_rule_score(r["judge_name"])
                if vital_score <= -900:
                    continue
                selected_boost = 30 if symptom in selected_symptoms else 0
                score = selected_boost + vital_score + complaint_rule_score(symptom, r["judge_name"])
                fp = _rule_display_fingerprint(r)
                if fp not in best_by_fp or score > best_by_fp[fp][0]:
                    best_by_fp[fp] = (score, r)
            pairs = list(best_by_fp.values())
            pairs.sort(
                key=lambda x: (x[0], int(x[1]["ttas_degree"])),
                reverse=True,
            )
            return pairs

        def top_rules_for_symptom(symptom: str, prefer: list) -> list:
            """先採用 LLM 排序之規則，不足 K 則依後端分數補滿；資料以 DB 為準。"""
            scored_full = [r for _, r in scored_list_for_symptom(symptom)]
            valid_codes = {r["rule_code"] for r in scored_full}
            out = []
            seen_code = set()
            seen_fp = set()
            for r in prefer:
                if len(out) >= RULES_TOP_K_PER_SYMPTOM:
                    break
                code = r.get("rule_code")
                if not code or code in seen_code or code not in valid_codes:
                    continue
                base = next(x for x in scored_full if x["rule_code"] == code)
                fp = _rule_display_fingerprint(base)
                if fp in seen_fp:
                    continue
                out.append(dict(base))
                seen_code.add(code)
                seen_fp.add(fp)
            for r in scored_full:
                if len(out) >= RULES_TOP_K_PER_SYMPTOM:
                    break
                fp = _rule_display_fingerprint(r)
                if r["rule_code"] in seen_code or fp in seen_fp:
                    continue
                out.append(dict(r))
                seen_code.add(r["rule_code"])
                seen_fp.add(fp)
            return out

        narrow_blocks = []
        narrow_flat = []
        for symptom in candidate_symptoms:
            pairs = scored_list_for_symptom(symptom)
            pool = pairs[:RULES_POOL_PER_SYMPTOM]
            lines = "\n".join(
                f'- {r["symptom_name"]} (第{r["ttas_degree"]}級): {r["judge_name"]} [{r["rule_code"]}]'
                for _, r in pool
            )
            narrow_blocks.append(
                f"【{symptom}】候選（精簡後最多 {RULES_POOL_PER_SYMPTOM} 條）\n"
                f"{lines if lines else '（無與目前生命徵象相容之規則）'}"
            )
            for _, r in pool:
                narrow_flat.append(dict(r))

        if not narrow_flat:
            final_out = []
            for symptom in candidate_symptoms:
                final_out.extend(top_rules_for_symptom(symptom, []))
            return RecommendRulesResponse(recommended_rules=final_out)

        code_to_rule = {r["rule_code"]: r for r in narrow_flat}
        candidate_lines = "\n\n".join(narrow_blocks)
        max_total = RULES_TOP_K_PER_SYMPTOM * len(candidate_symptoms)

        rag_chunks = []
        try:
            for s in candidate_symptoms:
                rag_docs = rag_pipeline.retrieve_relevant_knowledge(
                    query=f"主訴：{chief_complaint}；症狀：{s}；生命徵象：{json.dumps(filled_vitals, ensure_ascii=False)}",
                    category=None,
                    n_results=RULES_TOP_K_PER_SYMPTOM,
                )
                if rag_docs:
                    rag_chunks.append(
                        f"【{s}】\n{rag_pipeline.format_context_for_llm(rag_docs)}"
                    )
        except Exception as e:
            print("[RULES] RAG 檢索失敗:", e)
        rag_context = "\n\n---\n\n".join(rag_chunks) if rag_chunks else ""

        prompt = f"""你是急診檢傷專家。請依「主訴 + 已選症狀 + 已填生命徵象」推薦判斷規則。

**數量要求（重要）**：每個已選症狀請各自推薦 **2～3 條**（盡量 3 條）判斷規則；不同症狀分開考量，勿只為整體選一組規則。
總輸出筆數最多 {max_total} 條。

重要（避免過度升級 over-triage）：
- 不要預設最嚴重情況；只能根據已選症狀、已填生命徵象與下方 TTAS 摘錄推論。
- 若無明確危急徵象或數值不符，勿選第一級；資訊不足時選較低嚴重度之規則。
- 只能從候選規則中選擇，不得發明規則；同一 rule_code 勿重複輸出。

主訴：{chief_complaint if chief_complaint else "無"}
已選症狀：{", ".join(selected_symptoms)}
已填生命徵象：{json.dumps(filled_vitals, ensure_ascii=False) if filled_vitals else "無"}
相關知識（僅供參考，依症狀分段）：
{rag_context if rag_context else "無"}

候選規則（只能從以下選，已依症狀分段）：
{candidate_lines}

只輸出 JSON 陣列，格式：
[{{"rule_code":"...","symptom_name":"...","judge_name":"...","ttas_degree":2}}, ...]
"""
        llm_fn = call_gemini_llm if llm_mode == "cloud" else call_local_llm
        raw = llm_fn(prompt).strip()

        allowed_codes = {r["rule_code"] for r in narrow_flat}
        by_sym_llm = defaultdict(list)
        llm_fp_seen = defaultdict(set)
        try:
            parsed = json.loads(raw)
            for row in parsed if isinstance(parsed, list) else []:
                if not isinstance(row, dict):
                    continue
                code = row.get("rule_code")
                if code not in allowed_codes:
                    continue
                base_rule = code_to_rule.get(code)
                if not base_rule:
                    continue
                vscore = vitals_rule_score(base_rule["judge_name"])
                if vscore <= -900:
                    continue
                sym = base_rule["symptom_name"]
                fp = _rule_display_fingerprint(base_rule)
                if fp in llm_fp_seen[sym]:
                    continue
                llm_fp_seen[sym].add(fp)
                by_sym_llm[sym].append((vscore, dict(base_rule)))
        except Exception:
            pass

        for sym in by_sym_llm:
            by_sym_llm[sym].sort(
                key=lambda x: (x[0], int(x[1]["ttas_degree"])),
                reverse=True,
            )

        final_out = []
        for symptom in candidate_symptoms:
            prefer = [r for _, r in by_sym_llm.get(symptom, [])]
            final_out.extend(top_rules_for_symptom(symptom, prefer))

        return RecommendRulesResponse(recommended_rules=final_out)
    except Exception as e:
        print("Recommend rules error:", e)
        return RecommendRulesResponse(recommended_rules=[])

