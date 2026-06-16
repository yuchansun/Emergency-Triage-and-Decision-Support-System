#!/bin/bash
# 專題發表當天：產生展示用檢傷假資料（等同直接執行 seed_demo_triage_data.py）
set -e
cd "$(dirname "$0")/.."
python3 scripts/seed_demo_triage_data.py
echo ""
echo "完成。請重新整理前端頁面查看檢傷紀錄與統計分析。"
