import sys
sys.stdout.reconfigure(encoding='utf-8')
import requests
import json
import time
import csv
import os

# ========== 設定 ==========
LLM_BASE = "http://localhost:8000"
API_BASE = "http://localhost:9000"
LLM_MODE = "local"  # 改成 "cloud" 就用 Gemini
MODEL_LABEL = "llama3"

# ========== 讀取測試資料 ==========
def load_test_cases(path="test_cases.jsonl"):
    """從 jsonl 讀取測試資料（每筆是一個 JSON 物件，物件之間可有空白行）"""
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    decoder = json.JSONDecoder()
    cases = []
    idx = 0
    content = content.strip()
    while idx < len(content):
        while idx < len(content) and content[idx] in " \t\n\r":
            idx += 1
        if idx >= len(content):
            break
        obj, end = decoder.raw_decode(content, idx)
        cases.append(obj)
        idx = end
    return cases

# ========== 測試邏輯 ==========
VITAL_KEYS = [
    "temperature", "heart_rate", "respiratory_rate",
    "blood_pressure_sys", "blood_pressure_dia", "spo2",
    "blood_sugar", "weight", "gcs_eye", "gcs_verbal", "gcs_motor", "pain_score"
]

def get_vitals(patient):
    return {k: patient[k] for k in VITAL_KEYS if patient.get(k) is not None}

def get_gt_symptom(patient):
    pairs = patient.get("symptom_rule_pairs", [])
    if not pairs:
        return ""
    return pairs[0].get("symptom_name", "")

def fetch_all_symptoms():
    """從 triage_hierarchy 撈所有症狀名稱當候選清單"""
    try:
        res = requests.get(f"{API_BASE}/triage_hierarchy", timeout=30)
        res.raise_for_status()
        data = res.json()
        if isinstance(data, list):
            symptoms = list({row["symptom_name"] for row in data if row.get("symptom_name")})
            return symptoms
        return []
    except Exception as e:
        print(f"⚠️ 撈症狀清單失敗: {e}，將使用空清單")
        return []

def summarize_complaint(chief_complaint, vitals):
    try:
        clean_vitals = {k: str(v) for k, v in vitals.items()}
        t0 = time.time()
        res = requests.post(
            f"{LLM_BASE}/api/summarize-chief-complaint",
            json={"text": chief_complaint, "llm_mode": LLM_MODE, "vitals": clean_vitals},
            timeout=200
        )
        elapsed = time.time() - t0
        res.raise_for_status()
        return res.json().get("summary", ""), elapsed
    except Exception as e:
        return f"ERROR: {e}", 0

def recommend_symptoms_api(summary, all_candidates, vitals):
    if not all_candidates:
        return [], 0
    try:
        t0 = time.time()
        res = requests.post(
            f"{LLM_BASE}/api/recommend-symptoms",
            json={
                "text": summary,
                "symptom_candidates": all_candidates,
                "max_results": 5,
                "vitals": vitals,
                "llm_mode": LLM_MODE
            },
            timeout=200
        )
        elapsed = time.time() - t0
        res.raise_for_status()
        recommended = res.json().get("recommended_symptoms", [])
        return recommended, elapsed
    except Exception as e:
        return [], 0

def recommend_rules_api(symptom_candidates, vitals):
    try:
        t0 = time.time()
        res = requests.post(
            f"{LLM_BASE}/api/recommend-rules",
            json={"selected_symptoms": symptom_candidates, "vitals": vitals, "llm_mode": LLM_MODE},
            timeout=200
        )
        elapsed = time.time() - t0
        res.raise_for_status()
        rules = res.json().get("recommended_rules", [])
        if not rules:
            return None, [], elapsed
        best_level = min(r["ttas_degree"] for r in rules)
        return best_level, rules, elapsed
    except Exception as e:
        return None, f"ERROR: {e}", 0

def compute_recall_precision(gt_symptom, recommended_list):
    if not gt_symptom:
        return 0.0, 0.0, 0.0
    gt_set = {gt_symptom}
    rec_set = set(recommended_list)
    extract_recall = 1.0 if gt_set & rec_set else 0.0
    symptom_recall = len(gt_set & rec_set) / len(gt_set)
    symptom_precision = len(gt_set & rec_set) / len(rec_set) if rec_set else 0.0
    return extract_recall, symptom_recall, symptom_precision

# ========== 載入測試資料 ==========
jsonl_path = "test_cases.jsonl"
if not os.path.exists(jsonl_path):
    print(f"❌ 找不到 {jsonl_path}，請確認檔案放在同一個資料夾")
    exit(1)

patients = load_test_cases(jsonl_path)
print(f"OK: 從 {jsonl_path} 載入 {len(patients)} 筆測試資料")

# ========== 先撈症狀清單 ==========
print("正在從資料庫撈取症狀候選清單...")
ALL_SYMPTOMS = fetch_all_symptoms()
print(f"OK:共取得 {len(ALL_SYMPTOMS)} 個候選症狀\n")

# ========== 執行測試 ==========
print(f"{'='*60}")
print(f"開始測試，共 {len(patients)} 筆")
print(f"{'='*60}\n")

correct = 0
wrong = 0
error = 0
results = []
latencies_summarize = []
latencies_symptoms = []
latencies_rules = []

for i, p in enumerate(patients, 1):
    triage_id = p.get("triage_id", f"#{i}")
    expected = p.get("triage_level")
    chief_complaint = p.get("chief_complaint", "")
    vitals = get_vitals(p)
    expected_rule = p.get("rule_code", "")
    gt_symptom = get_gt_symptom(p)

    # Step 1: 整理主訴
    summary, t_sum = summarize_complaint(chief_complaint, vitals)

    # Step 2: 推薦症狀（從全部候選裡挑，撈不到就跳過）
    rec_symptoms, t_sym = recommend_symptoms_api(
        summary if not str(summary).startswith("ERROR") else chief_complaint,
        ALL_SYMPTOMS,
        vitals
    )

    # Step 3: 推薦規則（用推薦到的症狀，沒有就用 gt_symptom）
    rules_input = rec_symptoms if rec_symptoms else [gt_symptom]
    predicted, rules, t_rules = recommend_rules_api(rules_input, vitals)

    latencies_summarize.append(t_sum)
    latencies_symptoms.append(t_sym)
    latencies_rules.append(t_rules)

    predicted_codes = [r["rule_code"] for r in rules] if isinstance(rules, list) else []
    rule_hit = expected_rule in predicted_codes if expected_rule else False
    extract_recall, symptom_recall, symptom_precision = compute_recall_precision(gt_symptom, rec_symptoms)

    if isinstance(rules, str) and "ERROR" in rules:
        status = " API錯誤"
        error += 1
    elif predicted is None:
        status = " 無規則"
        error += 1
    elif predicted == expected:
        status = " 正確"
        correct += 1
    else:
        status = f" 預測:{predicted} 答案:{expected}"
        wrong += 1

    print(f"[{i:02d}] {triage_id}")
    print(f"     主訴: {chief_complaint[:40]}...")
    print(f"     症狀摘要: {summary}")
    print(f"     推薦症狀: {rec_symptoms}")
    print(f"     gt_symptom: {gt_symptom}")
    print(f"     結果: {status}")
    print()

    results.append({
        "triage_id": triage_id,
        "age": p.get("age"),
        "gt_level": expected,
        "pred_level": predicted,
        "level_diff": (predicted - expected) if predicted is not None else None,
        "gt_symptoms": gt_symptom,
        "extracted_symptoms": summary if not str(summary).startswith("ERROR") else "",
        "recommended_symptoms": "、".join(rec_symptoms),
        "extract_recall": round(extract_recall, 3),
        "symptom_recall": round(symptom_recall, 3),
        "symptom_precision": round(symptom_precision, 3),
        "gt_rule_code": expected_rule,
        "recommended_rule_codes": ",".join(predicted_codes),
        "rule_hit": rule_hit,
        "t_summarize": round(t_sum, 3),
        "t_recommend_symptoms": round(t_sym, 3),
        "t_recommend_rules": round(t_rules, 3),
        "t_triage_advice": None,
        "t_total": round(t_sum + t_sym + t_rules, 3),
        "errors": "API error" if "API錯誤" in status else "",
    })
    time.sleep(0.3)

# ========== 統計 ==========
total = len(results)
valid = [r for r in results if r["pred_level"] is not None]
under_triage = sum(1 for r in valid if r["pred_level"] > r["gt_level"])
over_triage = sum(1 for r in valid if r["pred_level"] < r["gt_level"])
mae = sum(abs(r["pred_level"] - r["gt_level"]) for r in valid) / total if total else 0
rule_hit_rate = sum(1 for r in results if r["rule_hit"]) / total if total else 0
avg_latency_sum = sum(latencies_summarize) / total if total else 0
avg_latency_sym = sum(latencies_symptoms) / total if total else 0
avg_latency_rules = sum(latencies_rules) / total if total else 0
avg_latency_total = avg_latency_sum + avg_latency_sym + avg_latency_rules
avg_extract_recall = sum(r["extract_recall"] for r in results) / total if total else 0
avg_symptom_recall = sum(r["symptom_recall"] for r in results) / total if total else 0
avg_symptom_precision = sum(r["symptom_precision"] for r in results) / total if total else 0

print(f"{'='*60}")
print(f"模型：{MODEL_LABEL}　　病例數：{total}")
print(f"{'='*60}")
print(f"最終級別準確率　　　　　: {correct/total:.3f}")
print(f"低估率（危險，越低越好）　: {under_triage/total:.3f}")
print(f"過度升級率　　　　　　　: {over_triage/total:.3f}")
print(f"級別平均誤差（MAE）　　　: {mae:.3f}")
print(f"症狀抽取召回率　　　　　: {avg_extract_recall:.3f}")
print(f"症狀推薦召回率　　　　　: {avg_symptom_recall:.3f}")
print(f"症狀推薦精確率　　　　　: {avg_symptom_precision:.3f}")
print(f"規則命中率（rule_code）　: {rule_hit_rate:.3f}")
print(f"平均總延遲（秒）　　　　　: {avg_latency_total:.3f}")
print(f"平均 summarize 延遲　　　: {avg_latency_sum:.3f}")
print(f"平均 recommend_symptoms　: {avg_latency_sym:.3f}")
print(f"平均 recommend_rules 延遲: {avg_latency_rules:.3f}")
print(f"發生錯誤的病例數　　　　　: {error}")
print(f"{'='*60}")

# 存 CSV
fieldnames = ["triage_id", "age", "gt_level", "pred_level", "level_diff",
              "gt_symptoms", "extracted_symptoms", "recommended_symptoms",
              "extract_recall", "symptom_recall", "symptom_precision",
              "gt_rule_code", "recommended_rule_codes", "rule_hit",
              "t_summarize", "t_recommend_symptoms", "t_recommend_rules",
              "t_triage_advice", "t_total", "errors"]
with open("test_cases_llama3.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(results)
print("詳細結果已存到 test_cases_llama3.csv")

# 存每筆 JSON
with open("test_cases_llama3.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print("詳細結果已存到 test_cases_llama3.json")

# 存整體指標 JSON
summary_data = {
    "label": MODEL_LABEL,
    "n_cases": total,
    "level_exact_acc": round(correct / total, 3) if total else 0,
    "under_triage_rate": round(under_triage / total, 3) if total else 0,
    "over_triage_rate": round(over_triage / total, 3) if total else 0,
    "level_mae": round(mae, 3),
    "extract_recall": round(avg_extract_recall, 3),
    "symptom_recall": round(avg_symptom_recall, 3),
    "symptom_precision": round(avg_symptom_precision, 3),
    "rule_hit_rate": round(rule_hit_rate, 3),
    "avg_latency_total": round(avg_latency_total, 3),
    "avg_latency_summarize": round(avg_latency_sum, 3),
    "avg_latency_recommend_symptoms": round(avg_latency_sym, 3),
    "avg_latency_recommend_rules": round(avg_latency_rules, 3),
    "cases_with_errors": error,
}
with open("test_results_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary_data, f, ensure_ascii=False, indent=2)
print("整體指標已存到 test_results_summary.json")