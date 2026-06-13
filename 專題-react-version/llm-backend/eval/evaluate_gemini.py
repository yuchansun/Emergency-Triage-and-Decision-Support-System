
"""
Gemini / cloud 模式檢傷流程自動化評測腳本。

這支腳本沿用同學的分層評測格式與輸出欄位，
但預設改成走 llm_mode=cloud，讓後端透過 Gemini API 執行。

輸出位置改為：
  eval/results_gemini/<label>_cases.jsonl
  eval/results_gemini/<label>_cases.csv
  eval/results_gemini/<label>_summary.json
  eval/results_gemini/compare.md
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import evaluate_models as em


BASE_DIR = Path(__file__).resolve().parent
RESULTS_DIR = BASE_DIR / "results_gemini"
DEFAULT_BASE_URL = "http://localhost:8001"
DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_LABEL = "gemini-2.5-flash"


# 讓直接按 VS Code 執行時，也一定能找到同層的 evaluate_models.py。
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


# 讓 evaluate_models 裡的共用 helper 直接寫到 Gemini 專屬輸出資料夾。
em.RESULTS_DIR = RESULTS_DIR


def main():
    parser = argparse.ArgumentParser(description="Gemini 檢傷流程自動化評測")
    parser.add_argument("--label", default=DEFAULT_LABEL,
                        help="模型標籤（用於命名輸出檔，例如 gemini-2.5-flash）")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="LLM 後端位址(:8001)")
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL,
                        help="主後端位址(:8000)，用來取候選症狀 /triage_hierarchy")
    parser.add_argument("--data", default=str(em.DATA_FILE), help="測試資料 jsonl 路徑")
    parser.add_argument("--timeout", type=int, default=120, help="每次 API 逾時秒數")
    parser.add_argument("--compare", action="store_true", help="只產生對照報表後結束")
    parser.add_argument("--fresh", action="store_true",
                        help="忽略先前進度、從頭重跑（會清掉同 label 的舊結果）")
    parser.add_argument("--limit", type=int, default=0,
                        help="只跑前 N 筆（0 = 全部）；小樣本除錯/省電用")
    args = parser.parse_args()

    if args.compare:
        em.build_compare()
        return

    cases = em.load_cases(Path(args.data))
    if not cases:
        print("⚠️ 沒有可評測的病例。")
        return
    if args.limit and args.limit > 0:
        cases = cases[: args.limit]
        print(f"⚙️ 僅評測前 {len(cases)} 筆（--limit）。")

    jsonl_path, csv_path, json_path = em.result_paths(args.label)

    if args.fresh:
        for p in (jsonl_path, csv_path, json_path):
            if p.exists():
                p.unlink()

    rows = em.load_existing_rows(jsonl_path)
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
        row = em.evaluate_case(args.base_url, args.api_base_url, rec, "cloud", args.timeout)
        rows.append(row)
        em.append_row_jsonl(jsonl_path, row)
        em.write_csv_and_summary(args.label, rows, csv_path, json_path)
        if tid:
            done_ids.add(tid)
        flag = "⚠️" if row["errors"] else "✓"
        print(f" {flag} 級別 {row['gt_level']}→{row['pred_level']}，"
              f"耗時 {row['t_total']}s（已存檔 {len(rows)}/{total}）")

    if not rows:
        print("⚠️ 沒有可評測的病例。")
        return

    summary = em.write_csv_and_summary(args.label, rows, csv_path, json_path)
    em.print_summary(summary)
    print(f"\n📄 明細：{csv_path}")
    print(f"📄 彙總：{json_path}")
    print(f"📄 即時記錄：{jsonl_path}（中斷後再跑同 label 會自動續跑）")
    print("\n提示：兩個模型都跑完後，執行 `python eval/evaluate_gemini.py --compare` 產生並排對照表。")


if __name__ == "__main__":
    main()