#!/usr/bin/env python3
"""
LLM 檢傷流程自動化評測腳本（Qwen 7B vs 14B 等模型比較）

設計重點
========
本系統的最終檢傷級別是「LLM + 規則層」混合決定的（見 rag_pipeline.compute_final_ttas_degree），
LLM 只負責中間的「症狀抽取 / 症狀推薦 / 規則推薦」。因此本腳本採「分層評測」，
不會只看一個最終級別數字，而是把每個 LLM 環節都對照標準答案。

評測會完整重現前端的 3 步 LLM 流程，全部打在 LLM 後端（預設 http://localhost:8001）：
  1. /api/summarize-chief-complaint   主訴 → 症狀關鍵詞
  2. /api/recommend-symptoms          症狀關鍵詞 + 候選清單 → 推薦症狀
  3. /api/recommend-rules             推薦症狀 + 主訴 + 生命徵象 → 判斷規則(rule_code)

最終級別（pred_level）依前端 SystemRecommendation 的 worstSelectedDegree 邏輯推算：
  - 若標準 rule_code 出現在推薦清單 → 取該規則的 ttas_degree（模擬護理師點選正確規則）
  - 否則若推薦清單非空 → 取所有推薦規則中最嚴重（最小）的 ttas_degree
  - 不再使用 /api/triage-advice（前端未使用，且其 RAG 規則層會誤降第 1 級）

候選症狀清單（recommend-symptoms 需要）直接從資料庫 triage_hierarchy 取得，
並依年齡套用與前端相同的 system_code 過濾（成人排除 P*、孩童排除 A*，外傷 T/E 不受年齡影響）。

使用方式（A 案：不改後端，重啟跑兩次）
=====================================
  # 1) 先在 .env 設 OLLAMA_MODEL=qwen2.5:7b-instruct，啟動後端：
  #    uvicorn main:app --port 8001
  # 2) 跑第一個模型（--label 只用來命名輸出檔，請填當前後端載入的模型）：
  python eval/evaluate_models.py --label qwen2.5-7b

  # 3) 把 .env 改成 OLLAMA_MODEL=qwen2.5:14b-instruct，重啟後端，再跑：
  python eval/evaluate_models.py --label qwen2.5-14b

  # 4) 產生兩個模型的並排對照報表：
  python eval/evaluate_models.py --compare

輸出
====
  eval/results/<label>_cases.csv     每一筆病例的詳細結果
  eval/results/<label>_summary.json  該模型的彙總指標
  eval/results/compare.md            （--compare）所有模型並排對照表（可直接貼進報告）
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from statistics import mean

import requests

# 讓本腳本能 import 上一層 llm-backend 的 database 模組
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

try:
    from database import fetch_all
except Exception:  # pragma: no cover
    # 候選症狀預設改走 HTTP /triage_hierarchy，DB 只是備援，這裡靜默忽略即可。
    fetch_all = None

DEFAULT_BASE_URL = "http://localhost:8001"        # LLM 後端
DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"    # 主後端（提供 /triage_hierarchy）
DATA_FILE = Path(__file__).resolve().parent / "test_cases.jsonl"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

# 真實資料(snake_case) → 前端送給後端的 vitals key(camelCase)。
# 必須轉換，否則 compute_final_ttas_degree 的危急判斷讀不到 systolicBP / gcsEye 等欄位。
VITALS_KEY_MAP = {
    "temperature": "temperature",
    "heart_rate": "heartRate",
    "spo2": "spo2",
    "respiratory_rate": "respRate",
    "weight": "weight",
    "blood_pressure_sys": "systolicBP",
    "blood_pressure_dia": "diastolicBP",
    "blood_sugar": "bloodSugar",
    "gcs_eye": "gcsEye",
    "gcs_verbal": "gcsVerbal",
    "gcs_motor": "gcsMotor",
    "pain_score": "painScore",
}

def _safe_ttas_degree(rule: dict) -> int | None:
    try:
        deg = int(rule.get("ttas_degree"))
        return deg if 1 <= deg <= 5 else None
    except (TypeError, ValueError):
        return None


def compute_pred_level_from_rules(rules: list[dict], gt_rule: str | None) -> tuple[int | None, str | None]:
    """依前端 worstSelectedDegree 邏輯，從 recommend-rules 回傳推算 pred_level。

    回傳 (級別, 來源說明)；來源為 gt_rule | min_recommended | None。
    """
    if not rules:
        return None, None

    if gt_rule:
        for rule in rules:
            if rule.get("rule_code") == gt_rule:
                deg = _safe_ttas_degree(rule)
                if deg is not None:
                    return deg, "gt_rule"

    degrees = [_safe_ttas_degree(r) for r in rules]
    degrees = [d for d in degrees if d is not None]
    if not degrees:
        return None, None
    return min(degrees), "min_recommended"


# ──────────────────────────────────────────────────────────────────────────
# 資料載入與前處理
# ──────────────────────────────────────────────────────────────────────────
def load_cases(path: Path) -> list[dict]:
    """萬用載入：支援 JSONL(一行一筆)、整包陣列 [...]、以及縮排多行/逗號分隔的多個物件。

    用 raw_decode 逐一掃出連續的 JSON 物件，因此不在意換行、縮排或物件間的逗號，
    讓你和同學可以直接把資料庫匯出的漂亮格式貼進來，不用壓成一行。
    """
    if not path.exists():
        raise FileNotFoundError(f"找不到測試資料檔：{path}")
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []

    decoder = json.JSONDecoder()
    cases: list[dict] = []
    idx, n = 0, len(text)
    while idx < n:
        # 跳過物件之間的空白、換行、逗號與陣列括號
        while idx < n and text[idx] in " \t\r\n,[]":
            idx += 1
        if idx >= n:
            break
        try:
            obj, end = decoder.raw_decode(text, idx)
        except json.JSONDecodeError:
            # 解析不過時，跳到下一個 '{' 再試，避免一筆壞掉拖垮全部
            nxt = text.find("{", idx + 1)
            if nxt == -1:
                print(f"⚠️ 第 {idx} 字元後無法解析，略過剩餘內容。")
                break
            print(f"⚠️ 略過第 {idx} 字元附近一段無法解析的內容。")
            idx = nxt
            continue
        if isinstance(obj, dict):
            if _looks_like_case(obj):
                cases.append(obj)
        elif isinstance(obj, list):
            cases.extend(x for x in obj if isinstance(x, dict) and _looks_like_case(x))
        idx = end
    return cases


def _looks_like_case(obj: dict) -> bool:
    """過濾掉內層小物件（如 symptom_rule_pairs 的元素），只留真正的病例。"""
    return any(k in obj for k in ("triage_id", "chief_complaint", "triage_level"))


def build_vitals(rec: dict) -> dict:
    """把單筆病例的生命徵象轉成前端格式（字串、camelCase），跳過 null/空值。"""
    vitals = {}
    for snake, camel in VITALS_KEY_MAP.items():
        val = rec.get(snake)
        if val is None or (isinstance(val, str) and not val.strip()):
            continue
        vitals[camel] = str(val)
    return vitals


_triage_rows_cache: list[dict] | None = None
_candidate_cache: dict[bool, list[str]] = {}


def _load_triage_rows(api_base_url: str) -> list[dict]:
    """取得 triage_hierarchy 全表（system_code, symptom_name...）。

    與前端一致，優先打主後端的 /triage_hierarchy；失敗才退回直接讀 DB。
    """
    global _triage_rows_cache
    if _triage_rows_cache is not None:
        return _triage_rows_cache

    # 1) HTTP（與前端相同來源，免裝 mysql）
    try:
        resp = requests.get(f"{api_base_url}/triage_hierarchy", timeout=30)
        resp.raise_for_status()
        data = resp.json()
        rows = data if isinstance(data, list) else data.get("data") or data.get("rows") or []
        if rows:
            print(f"✅ 候選症狀來源：HTTP {api_base_url}/triage_hierarchy（{len(rows)} 列）")
            _triage_rows_cache = rows
            return rows
    except Exception as e:
        print(f"ℹ️ 無法從 {api_base_url}/triage_hierarchy 取候選（{e}），改試資料庫。")

    # 2) DB 備援
    if fetch_all is not None:
        try:
            rows = fetch_all(
                "SELECT DISTINCT system_code, symptom_name FROM triage_hierarchy "
                "WHERE symptom_name IS NOT NULL"
            )
            if rows:
                print(f"✅ 候選症狀來源：資料庫 triage_hierarchy（{len(rows)} 列）")
                _triage_rows_cache = rows
                return rows
        except Exception as e:
            print(f"⚠️ 讀取 triage_hierarchy 失敗：{e}")

    print("⚠️ 取不到候選症狀清單，recommend-symptoms 將拿到空清單（症狀推薦指標會失準）。")
    _triage_rows_cache = []
    return []


def get_candidate_symptoms(is_adult: bool, api_base_url: str) -> list[str]:
    """依年齡套用與前端相同的 system_code 過濾，回傳候選症狀名稱清單。"""
    if is_adult in _candidate_cache:
        return _candidate_cache[is_adult]
    rows = _load_triage_rows(api_base_url)
    seen, candidates = set(), []
    for row in rows or []:
        code = str(row.get("system_code") or "")
        name = row.get("symptom_name")
        if not name:
            continue
        # 與前端一致：成人排除 P*（小兒），孩童排除 A*（成人非外傷）；T/E 外傷不受影響
        if code.startswith("A") and not is_adult:
            continue
        if code.startswith("P") and is_adult:
            continue
        if name not in seen:
            seen.add(name)
            candidates.append(name)
    _candidate_cache[is_adult] = candidates
    return candidates


# ──────────────────────────────────────────────────────────────────────────
# API 呼叫（每步計時）
# ──────────────────────────────────────────────────────────────────────────
def _post(base_url: str, path: str, payload: dict, timeout: int):
    start = time.perf_counter()
    try:
        resp = requests.post(f"{base_url}{path}", json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json(), time.perf_counter() - start, None
    except Exception as e:
        return None, time.perf_counter() - start, str(e)


# ──────────────────────────────────────────────────────────────────────────
# 比對工具
# ──────────────────────────────────────────────────────────────────────────
def _overlap(a: str, b: str) -> bool:
    """與後端 _symptom_overlap 一致：去空白後互為子字串即視為同一概念。"""
    a = (a or "").replace(" ", "").strip()
    b = (b or "").replace(" ", "").strip()
    return bool(a and b and (a in b or b in a))


def symptom_recall_precision(gt: list[str], pred: list[str]):
    """以子字串重疊比對（容忍 TTAS 標準名與口語名的字面差異）計算召回率/精確率。"""
    if not gt:
        return None, None
    hit_gt = sum(1 for g in gt if any(_overlap(g, p) for p in pred))
    recall = hit_gt / len(gt)
    if not pred:
        return recall, None
    hit_pred = sum(1 for p in pred if any(_overlap(p, g) for g in gt))
    precision = hit_pred / len(pred)
    return recall, precision


# ──────────────────────────────────────────────────────────────────────────
# 單筆病例評測
# ──────────────────────────────────────────────────────────────────────────
def evaluate_case(base_url: str, api_base_url: str, rec: dict, llm_mode: str, timeout: int) -> dict:
    age = rec.get("age")
    is_adult = (age is None) or (age >= 18)
    vitals = build_vitals(rec)
    chief = rec.get("chief_complaint") or ""
    candidates = get_candidate_symptoms(is_adult, api_base_url)

    gt_symptoms = [
        p.get("symptom_name")
        for p in (rec.get("symptom_rule_pairs") or [])
        if p.get("symptom_name")
    ]
    gt_rule = rec.get("rule_code")
    gt_level = rec.get("triage_level")

    timings, errors = {}, {}

    # Step 1：主訴 → 症狀關鍵詞
    data, t, err = _post(
        base_url, "/api/summarize-chief-complaint",
        {"text": chief, "llm_mode": llm_mode, "vitals": vitals}, timeout,
    )
    timings["summarize"] = t
    summary = (data or {}).get("summary", "") if not err else ""
    if err:
        errors["summarize"] = err
    extracted = [s.strip() for s in summary.split("、") if s.strip()]

    # Step 2：候選清單 → 推薦症狀
    data, t, err = _post(
        base_url, "/api/recommend-symptoms",
        {"text": summary, "symptom_candidates": candidates, "max_results": 5,
         "llm_mode": llm_mode, "vitals": vitals}, timeout,
    )
    timings["recommend_symptoms"] = t
    recommended = (data or {}).get("recommended_symptoms", []) if not err else []
    if err:
        errors["recommend_symptoms"] = err

    # 推薦症狀若為空，退回抽取結果，讓後續步驟仍可進行（與真實情境一致）
    selected = recommended or extracted

    # Step 3：症狀 + 主訴 + 徵象 → 判斷規則
    # 與前端一致：chief_complaint 送統整後的 summary（inputText），不是原始主訴
    data, t, err = _post(
        base_url, "/api/recommend-rules",
        {"selected_symptoms": selected, "chief_complaint": summary,
         "vitals": vitals, "llm_mode": llm_mode, "age": rec.get("age")}, timeout,
    )
    timings["recommend_rules"] = t
    rules = (data or {}).get("recommended_rules", []) if not err else []
    if err:
        errors["recommend_rules"] = err
    rule_codes = [r.get("rule_code") for r in rules if r.get("rule_code")]

    # 最終級別：對齊前端 worstSelectedDegree（見 compute_pred_level_from_rules）
    pred_level, pred_level_source = compute_pred_level_from_rules(rules, gt_rule)

    # 指標
    ex_recall, _ = symptom_recall_precision(gt_symptoms, extracted)
    rec_recall, rec_prec = symptom_recall_precision(gt_symptoms, recommended)
    rule_hit = (gt_rule in rule_codes) if gt_rule else None
    level_diff = (pred_level - gt_level) if (pred_level and gt_level) else None

    return {
        "triage_id": rec.get("triage_id"),
        "age": age,
        "gt_level": gt_level,
        "pred_level": pred_level,
        "pred_level_source": pred_level_source or "",
        # 註：級別數字越小越嚴重。diff>0 = 低估(under-triage，危險)；diff<0 = 過度升級
        "level_diff": level_diff,
        "gt_symptoms": "、".join(gt_symptoms),
        "extracted_symptoms": "、".join(extracted),
        "recommended_symptoms": "、".join(recommended),
        "extract_recall": ex_recall,
        "symptom_recall": rec_recall,
        "symptom_precision": rec_prec,
        "gt_rule_code": gt_rule,
        "recommended_rule_codes": ",".join(rule_codes),
        "rule_hit": rule_hit,
        "t_summarize": round(timings["summarize"], 2),
        "t_recommend_symptoms": round(timings["recommend_symptoms"], 2),
        "t_recommend_rules": round(timings["recommend_rules"], 2),
        "t_total": round(sum(timings.values()), 2),
        "errors": "; ".join(f"{k}:{v}" for k, v in errors.items()),
    }


# ──────────────────────────────────────────────────────────────────────────
# 彙總
# ──────────────────────────────────────────────────────────────────────────
def _mean_or_none(values):
    vals = [v for v in values if v is not None]
    return round(mean(vals), 3) if vals else None


def aggregate(label: str, rows: list[dict]) -> dict:
    n = len(rows)
    level_pairs = [(r["pred_level"], r["gt_level"]) for r in rows
                   if r["pred_level"] and r["gt_level"]]
    exact = sum(1 for p, g in level_pairs if p == g)
    within_1 = sum(1 for p, g in level_pairs if abs(p - g) <= 1)
    under = sum(1 for p, g in level_pairs if p > g)   # 預測較不嚴重 = 低估
    over = sum(1 for p, g in level_pairs if p < g)    # 預測較嚴重 = 過度升級
    rule_judged = [r for r in rows if r["rule_hit"] is not None]
    rule_hits = sum(1 for r in rule_judged if r["rule_hit"])
    err_cnt = sum(1 for r in rows if r["errors"])

    return {
        "label": label,
        "n_cases": n,
        "level_exact_acc": round(exact / len(level_pairs), 3) if level_pairs else None,
        "level_within_1_acc": round(within_1 / len(level_pairs), 3) if level_pairs else None,
        "under_triage_rate": round(under / len(level_pairs), 3) if level_pairs else None,
        "over_triage_rate": round(over / len(level_pairs), 3) if level_pairs else None,
        "level_mae": _mean_or_none([abs(r["level_diff"]) for r in rows]),
        "extract_recall": _mean_or_none([r["extract_recall"] for r in rows]),
        "symptom_recall": _mean_or_none([r["symptom_recall"] for r in rows]),
        "symptom_precision": _mean_or_none([r["symptom_precision"] for r in rows]),
        "rule_hit_rate": round(rule_hits / len(rule_judged), 3) if rule_judged else None,
        "avg_latency_total": _mean_or_none([r["t_total"] for r in rows]),
        "avg_latency_summarize": _mean_or_none([r["t_summarize"] for r in rows]),
        "avg_latency_recommend_symptoms": _mean_or_none([r["t_recommend_symptoms"] for r in rows]),
        "avg_latency_recommend_rules": _mean_or_none([r["t_recommend_rules"] for r in rows]),
        "cases_with_errors": err_cnt,
    }


def result_paths(label: str):
    """回傳該模型的三個輸出檔路徑：jsonl(即時記錄) / csv(明細) / summary(彙總)。"""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return (
        RESULTS_DIR / f"{label}_cases.jsonl",
        RESULTS_DIR / f"{label}_cases.csv",
        RESULTS_DIR / f"{label}_summary.json",
    )


def load_existing_rows(jsonl_path: Path) -> list[dict]:
    """讀回先前已完成的逐筆結果（供中斷後續跑用）。"""
    rows: list[dict] = []
    if not jsonl_path.exists():
        return rows
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def append_row_jsonl(jsonl_path: Path, row: dict):
    """單筆即時存檔（append 一行），這是中斷後不白費的關鍵。"""
    with jsonl_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
        f.flush()


def write_csv_and_summary(label: str, rows: list[dict], csv_path: Path, json_path: Path) -> dict:
    """依目前所有 rows 重新產生 CSV 明細與 summary（每筆跑完都會呼叫一次，確保隨時有最新檔）。"""
    if rows:
        with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    summary = aggregate(label, rows)
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def print_summary(summary: dict):
    print("\n" + "═" * 52)
    print(f"  模型：{summary['label']}　病例數：{summary['n_cases']}")
    print("═" * 52)
    label_map = [
        ("level_exact_acc", "最終級別準確率"),
        ("level_within_1_acc", "級別±1準確率"),
        ("under_triage_rate", "低估率(危險,越低越好)"),
        ("over_triage_rate", "過度升級率"),
        ("level_mae", "級別平均誤差(MAE)"),
        ("extract_recall", "症狀抽取召回率"),
        ("symptom_recall", "症狀推薦召回率"),
        ("symptom_precision", "症狀推薦精確率"),
        ("rule_hit_rate", "規則命中率(rule_code)"),
        ("avg_latency_total", "平均總延遲(秒)"),
        ("cases_with_errors", "發生錯誤的病例數"),
    ]
    note = (
        "  pred_level 來源：recommend-rules（對齊前端 worstSelectedDegree），"
        "非 triage-advice RAG 規則層。"
    )
    for key, name in label_map:
        print(f"  {name:<22}：{summary.get(key)}")
    print("═" * 52)
    print(note)


# ──────────────────────────────────────────────────────────────────────────
# 對照報表
# ──────────────────────────────────────────────────────────────────────────
def build_compare():
    files = sorted(RESULTS_DIR.glob("*_summary.json"))
    if not files:
        print("⚠️ 找不到任何 *_summary.json，請先跑各模型的評測。")
        return
    summaries = [json.loads(f.read_text(encoding="utf-8")) for f in files]
    metrics = [
        ("n_cases", "病例數"),
        ("level_exact_acc", "最終級別準確率"),
        ("level_within_1_acc", "級別±1準確率"),
        ("under_triage_rate", "低估率(危險)"),
        ("over_triage_rate", "過度升級率"),
        ("level_mae", "級別平均誤差MAE"),
        ("extract_recall", "症狀抽取召回率"),
        ("symptom_recall", "症狀推薦召回率"),
        ("symptom_precision", "症狀推薦精確率"),
        ("rule_hit_rate", "規則命中率"),
        ("avg_latency_total", "平均總延遲(秒)"),
        ("cases_with_errors", "錯誤病例數"),
    ]
    header = "| 指標 | " + " | ".join(s["label"] for s in summaries) + " |"
    sep = "|---|" + "---|" * len(summaries)
    lines = ["# 模型評測對照表", "", header, sep]
    for key, name in metrics:
        cells = " | ".join(str(s.get(key)) for s in summaries)
        lines.append(f"| {name} | {cells} |")
    md = "\n".join(lines) + "\n"
    out = RESULTS_DIR / "compare.md"
    out.write_text(md, encoding="utf-8")
    print(md)
    print(f"📄 已輸出對照表：{out}")


# ──────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="LLM 檢傷流程自動化評測")
    parser.add_argument("--label", help="模型標籤（用於命名輸出檔，例如 qwen2.5-7b）")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="LLM 後端位址(:8001)")
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL,
                        help="主後端位址(:8000)，用來取候選症狀 /triage_hierarchy")
    parser.add_argument("--data", default=str(DATA_FILE), help="測試資料 jsonl 路徑")
    parser.add_argument("--llm-mode", default="local", choices=["local", "cloud"])
    parser.add_argument("--timeout", type=int, default=120, help="每次 API 逾時秒數")
    parser.add_argument("--compare", action="store_true", help="只產生對照報表後結束")
    parser.add_argument("--fresh", action="store_true",
                        help="忽略先前進度、從頭重跑（會清掉同 label 的舊結果）")
    parser.add_argument("--limit", type=int, default=0,
                        help="只跑前 N 筆（0 = 全部）；小樣本除錯/省電用")
    args = parser.parse_args()

    if args.compare:
        build_compare()
        return

    if not args.label:
        parser.error("請用 --label 指定當前後端載入的模型名稱（例如 --label qwen2.5-7b）")

    cases = load_cases(Path(args.data))
    if not cases:
        print("⚠️ 沒有可評測的病例。")
        return
    if args.limit and args.limit > 0:
        cases = cases[: args.limit]
        print(f"⚙️ 僅評測前 {len(cases)} 筆（--limit）。")

    jsonl_path, csv_path, json_path = result_paths(args.label)

    # --fresh：清掉舊結果重跑
    if args.fresh:
        for p in (jsonl_path, csv_path, json_path):
            if p.exists():
                p.unlink()

    # 續跑：載入先前已完成的逐筆結果，之後自動跳過
    rows = load_existing_rows(jsonl_path)
    done_ids = {r.get("triage_id") for r in rows if r.get("triage_id")}
    if rows:
        print(f"↩️ 偵測到先前已完成 {len(rows)} 筆，將自動跳過、只補未完成的"
              f"（要重頭跑請加 --fresh）。")

    total = len(cases)
    print(f"🔎 載入 {total} 筆病例，開始評測（模型標籤：{args.label}）...")

    for i, rec in enumerate(cases, 1):
        tid = rec.get("triage_id")
        if tid and tid in done_ids:
            print(f"  [{i}/{total}] {tid} ... ⏭ 已完成，跳過")
            continue
        print(f"  [{i}/{total}] {tid or '?'} ...", end="", flush=True)
        row = evaluate_case(args.base_url, args.api_base_url, rec, args.llm_mode, args.timeout)
        rows.append(row)
        # 關鍵：單筆即時存檔 + 同步更新 CSV/summary，中途中斷已跑的不會白費
        append_row_jsonl(jsonl_path, row)
        write_csv_and_summary(args.label, rows, csv_path, json_path)
        if tid:
            done_ids.add(tid)
        flag = "⚠️" if row["errors"] else "✓"
        print(f" {flag} 級別 {row['gt_level']}→{row['pred_level']}，"
              f"耗時 {row['t_total']}s（已存檔 {len(rows)}/{total}）")

    if not rows:
        print("⚠️ 沒有可評測的病例。")
        return

    summary = write_csv_and_summary(args.label, rows, csv_path, json_path)
    print_summary(summary)
    print(f"\n📄 明細：{csv_path}")
    print(f"📄 彙總：{json_path}")
    print(f"📄 即時記錄：{jsonl_path}（中斷後再跑同 label 會自動續跑）")
    print("\n提示：兩個模型都跑完後，執行 `python eval/evaluate_models.py --compare` 產生並排對照表。")


if __name__ == "__main__":
    main()
