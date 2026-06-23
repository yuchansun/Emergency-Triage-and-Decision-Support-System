# 急診檢傷輔助決策系統 — 安裝與啟動指南

本專案以 **React + FastAPI + MySQL + LLM（Ollama / Gemini）** 開發，提供急診檢傷流程輔助、主訴統整、症狀與規則推薦等功能。

**GitHub：** https://github.com/yuchansun/Emergency-Triage-and-Decision-Support-System.git

---

## 初次安裝完整流程（照順序做）

> 第一次 clone 請從第 1 步依序完成；日常開發只需看 **第 10 節**。

| 步驟 | 內容 | 章節 |
|------|------|------|
| ① | 安裝 Node.js、Python、XAMPP、Ollama | §1 |
| ② | `git clone` 專案 | §2 |
| ③ | 準備 **MySQL 匯入檔**（`.sql`） | §6 |
| ④ | 安裝 npm / pip 套件、下載 Ollama 模型 | §4 |
| ⑤ | 建立三份 `.env`（含 `api/.env` 資料庫連線） | §5、§6 |
| ⑥ | XAMPP 啟動 MySQL → phpMyAdmin **匯入 `.sql` 至 MySQL** | §6 |
| ⑦ | 依序啟動 Ollama → API 8000 → LLM 8001 → 前端 | §8 |
| ⑧ | 開啟 http://localhost:5173 登入（帳密見 `staff` 表） | §7、§9 |
| ⑨ | 確認 API 文件可開、主訴統整有回應 | §9 |

**資料庫怎麼運作：** `.sql` 只需在安裝時用 phpMyAdmin **匯入一次**到 MySQL。  
之後系統執行時，後端透過 `api/db.py` + `api/.env` **連線 MySQL**，不是讀專案資料夾裡的 `.sql` 檔。

---

## 1. 準備工具與開發環境

請先安裝下列工具（建議使用 VS Code）：

| 類別 | 工具 | 用途 |
|------|------|------|
| 前端 | Node.js（建議 LTS）、npm | React / Vite 開發 |
| 後端 | Python 3.10+、pip | FastAPI 資料庫 API、LLM 後端 |
| 資料庫 | MySQL（或 XAMPP 內建 MySQL） | 檢傷、病人、統計等資料 |
| AI 本地 | [Ollama](https://ollama.com/) | 本地 LLM（預設 qwen2.5:7b-instruct） |
| AI 雲端 | Google Gemini API Key | 雲端 LLM 模式（選用） |
| 選用 | 健保卡讀卡程式 `nhicard` | 讀取健保卡（port 8002） |
| 選用 | iPad + 同一 Wi‑Fi | 床邊展示（需 HTTPS 模式） |

---

## 2. 取得專案

```bash
git clone https://github.com/yuchansun/Emergency-Triage-and-Decision-Support-System.git
cd Emergency-Triage-and-Decision-Support-System/專題-react-version
```

> 若資料夾名稱不同，請以實際 clone 下來的路徑為準。

---

## 3. 系統架構與服務埠號

本系統由**多個獨立服務**組成，日常開發至少需啟動 **MySQL、資料庫 API、LLM 後端、Ollama、前端**。

| 服務 | 技術 | 預設網址 | 是否必開 |
|------|------|----------|----------|
| 前端 | React + Vite + TypeScript | http://localhost:5173 | ✅ 必開 |
| 資料庫 API | Python FastAPI | http://localhost:8000 | ✅ 必開 |
| LLM 後端 | Python FastAPI | http://localhost:8001 | ✅ 必開（主訴/症狀/規則 AI） |
| Ollama | 本地 LLM 服務 | http://localhost:11434 | ✅ 必開（本地模式） |
| MySQL | XAMPP / MySQL | localhost:3306 | ✅ 必開 |
| 健保卡讀卡 | nhicard | http://localhost:8002 | 選用 |
| iPad HTTPS 前端 | `npm run dev:ipad` | https://你的Mac名稱.local:5173 | 選用 |

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  React 前端  │────▶│  API :8000   │────▶│   MySQL     │
│  :5173      │     │  (FastAPI)   │     │             │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       └──────────▶┌──────────────┐     ┌─────────────┐
                   │ LLM :8001    │────▶│   Ollama    │
                   │  (FastAPI)   │     │  :11434     │
                   └──────────────┘     └─────────────┘
```

---

## 4. 套件與依賴一覽

### 前端（npm）

| 套件 | 功能 |
|------|------|
| react / react-dom | UI 框架 |
| vite | 開發伺服器與打包 |
| typescript | 型別檢查 |
| tailwindcss | 樣式 |
| recharts | 統計圖表 |
| @tiptap/* / ckeditor5 / tinymce | 富文字編輯（檢傷報告等） |
| opencc-js | 簡繁轉換 |
| @vitejs/plugin-basic-ssl | iPad HTTPS 模式（選用） |

安裝方式：

```bash
npm install
```

> **何時需要 `npm install`？**  
> 第一次 clone、或 `package.json` 有更新（例如 pull 新程式碼後）時執行一次。  
> 平常開發只需 `npm run dev`。

### 資料庫 API（pip）

```bash
cd api
pip3 install fastapi uvicorn pymysql python-dotenv pandas
```

### LLM 後端（pip）

```bash
cd llm-backend
pip3 install -r requirements.txt
```

主要包含：FastAPI、ChromaDB、LangChain、sentence-transformers、google-genai、Ollama 請求等。

### Ollama 模型（首次使用）

```bash
ollama pull qwen2.5:7b-instruct
# 選用（較大、較慢）：ollama pull qwen2.5:14b-instruct
```

---

## 5. 環境設定（.env）

專案有 **三份獨立的 `.env`**，請分別建立在對應資料夾。`.env` 已在 `.gitignore`，**不會被 commit**，每位成員需自行建立。

### 5-1. 前端 `.env`（專案根目錄 `專題-react-version/.env`）

新建檔案 `.env`（可複製根目錄 `.env.example` 後修改，內容如下）：

```env
# 平常開發（預設）
VITE_USE_SAME_ORIGIN=false
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_LLM_BASE_URL=http://127.0.0.1:8001
VITE_NHICARD_URL=http://127.0.0.1:8002
```

| 變數 | 說明 |
|------|------|
| `VITE_USE_SAME_ORIGIN` | `false`＝本機直連（組員預設）；`true`＝iPad 同源 HTTPS 代理 |
| `VITE_API_BASE_URL` | 資料庫 API 位址 |
| `VITE_LLM_BASE_URL` | LLM 後端位址 |
| `VITE_NHICARD_URL` | 健保卡讀卡服務位址 |

> 未設定時，程式會 fallback 至 `http://127.0.0.1:8000` / `8001` / `8002`。

### 5-2. 資料庫 API `.env`（`api/.env`）

可複製 `api/.env.example` 為 `api/.env` 後修改：

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=medical_triage_system
```

> `DB_NAME` 請改成你 phpMyAdmin 中實際的資料庫名稱。  
> 若連線失敗，**請優先排查資料庫名稱、帳密、XAMPP MySQL 是否已啟動**。

### 5-3. LLM 後端 `.env`（`llm-backend/.env`）

可複製 `llm-backend/.env.example` 為 `llm-backend/.env` 後修改：

```env
# Gemini 雲端模式（選用；前端切換 cloud 時使用）
GEMINI_API_KEY=請填入你的_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash

# Ollama 本地模式（預設）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
OLLAMA_NUM_PREDICT=128
OLLAMA_TIMEOUT=30

# Chroma 向量庫目錄（選用，預設 ./chroma_db）
# CHROMA_PERSIST_DIR=./chroma_db
```

> LLM 後端首次啟動若無向量庫，會依 `data/protocol_ttas.csv` 自動建立 Chroma 索引（需數分鐘，僅第一次較久）。

---

## 6. 資料庫設定（XAMPP / MySQL）

完整資料庫 `.sql` 通常不在 Git 內。安裝時用 phpMyAdmin 匯入至 **MySQL 伺服器**；  
匯入完成後，後端啟動時由 `api/db.py` 依 `api/.env` 連線該資料庫。

```
.sql 匯入檔  ──(phpMyAdmin 匯入，僅安裝時一次)──▶  MySQL (XAMPP)
                                                      ▲
前端 / API  ──────────────────────────────────────────┘
              api/db.py + api/.env（DB_HOST、DB_NAME…）
```

### 6-1. 啟動 MySQL

1. 開啟 **XAMPP** 控制面板  
2. 點 **Start** → **MySQL**（Apache 選用，本系統後端為 Python，不依賴 Apache）

### 6-2. 匯入完整資料庫（phpMyAdmin）

1. 瀏覽器開啟 http://localhost/phpmyadmin  
2. 左側若已有舊庫可先刪除，或新建一個資料庫  
   - 建議名稱：`medical_triage_system`（須與 `api/.env` 的 `DB_NAME` 一致）  
3. 點選該資料庫 → **匯入（Import）**  
4. 選擇你的 `.sql` 檔（檔案在電腦任意位置皆可）→ **執行**  
5. 匯入成功後，左側應能看到多張資料表，至少包含：
   - `staff`（護理人員／登入帳號）
   - `patients`、`triage_record`、`triage_result` 等

### 6-3. 設定後端連線（`api/.env`）

匯入 MySQL 後，確認 `api/.env` 與實際資料庫一致（`api/db.py` 會讀取這些設定）：

| 檔案 | 設定方式 |
|------|----------|
| `api/.env` | `DB_NAME=medical_triage_system` |
| `llm-backend/database.py` | `database='medical_triage_system'`（若你改名，需手動改此檔） |

XAMPP 預設帳密通常為 `root` / 空白密碼，與 `api/.env` 範例相同。

### 6-4. 選用：欄位更新腳本

若你的資料庫版本較舊，可於 phpMyAdmin **SQL** 分頁依序執行 `api/scripts/` 內的遷移檔：

- `add_patients_past_medical_history.sql`
- `add_patients_do_not_treat.sql`
- `alter_vital_signs_do_not_treat.sql`

> 全新匯入的完整 `.sql` 通常已含最新結構，**不必**再跑上述腳本。

---

## 7. 登入帳號

系統登入讀取 MySQL `staff` 表的 `username` / `password` 欄位（明碼比對）。

- 登入帳密來自匯入後的 `staff` 表（`username` / `password` 欄位）
- 登入成功後可於系統內「護理人員管理」新增或修改人員
- 若出現「帳號或密碼錯誤」：確認 §6 已匯入完整 `.sql`，且 `staff` 表內有資料

---

## 8. 啟動各服務

以下需**分開終端機**執行（或使用 tmux 等工具）。

### 8-1. MySQL

XAMPP 控制面板 → Start **MySQL**

### 8-2. Ollama

```bash
ollama serve
```

另開終端確認模型已下載：

```bash
ollama list
```

### 8-3. 資料庫 API（port 8000）

```bash
cd api
python3 -m uvicorn main:app --reload --port 8000
```

成功後：
- 終端顯示 `Uvicorn running on http://127.0.0.1:8000`
- API 文件：http://localhost:8000/docs

### 8-4. LLM 後端（port 8001）

```bash
cd llm-backend
python3 -m uvicorn main:app --reload --port 8001
```

成功後：
- 終端顯示 Ollama / Gemini 設定載入訊息
- API 文件：http://localhost:8001/docs

### 8-5. 前端（port 5173）

```bash
cd 專題-react-version    # 專案根目錄
npm install               # 首次或 package.json 更新後
npm run dev
```

成功後瀏覽器開啟：**http://localhost:5173**

### 8-6. 健保卡讀卡（選用，port 8002）

讀卡機接在 Mac 上時：

```bash
nhicard -p 8002
```

### 8-7. iPad 區域網路展示（選用）

需語音辨識或 iPad 遠端操作時，後端需加 `--host 0.0.0.0`，前端改用 HTTPS：

```bash
# 資料庫 API
cd api && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# LLM 後端
cd llm-backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# 前端 HTTPS
cd 專題-react-version && npm run dev:ipad
```

iPad 書籤：`https://你的Mac名稱.local:5173`  
（執行 `scripts/start-ipad.sh` 可列出完整檢查清單）

> Safari 首次連線會提示憑證不受信任，點「顯示詳細資料」→「造訪此網站」。  
> 語音辨識需 HTTPS，請務必用 `https://` 開啟。

---

## 9. 安裝完成確認

全部啟動後，依序檢查：

| 檢查項目 | 預期結果 |
|----------|----------|
| http://localhost:8000/docs | 顯示 FastAPI Swagger（資料庫 API） |
| http://localhost:8001/docs | 顯示 FastAPI Swagger（LLM 後端） |
| http://localhost:5173 | 顯示登入頁 |
| 登入 | 使用 `staff` 表中的帳密可進入系統 |
| 檢傷主訴「一鍵統整」 | 有 LLM 回應（首次可能較慢，見下方說明） |

**首次啟動 LLM 後端注意：**

- `llm-backend/chroma_db/` 不在 Git 內，**第一次**會依 `data/protocol_ttas.csv` 自動建立 Chroma 向量索引，終端可能停頓 **數分鐘**，屬正常現象  
- Ollama 模型**第一次**推論也會較慢（載入模型至記憶體）

---

## 10. 日常開發流程（快速對照）

每次開發至少開 **5 個**服務：

| 順序 | 終端 | 指令 |
|------|------|------|
| 1 | XAMPP | 啟動 MySQL |
| 2 | 任意 | `ollama serve` |
| 3 | `api/` | `python3 -m uvicorn main:app --reload --port 8000` |
| 4 | `llm-backend/` | `python3 -m uvicorn main:app --reload --port 8001` |
| 5 | 專案根目錄 | `npm run dev` |

---

## 11. 專案結構

```
專題-react-version/
├── src/                    # React 前端元件
│   ├── components/         # 檢傷、歷史、統計等頁面
│   └── config/
│       └── serviceUrls.ts  # API / LLM / 健保卡網址設定
├── api/                    # 資料庫 FastAPI（port 8000）
│   ├── main.py
│   ├── db.py
│   ├── routers/            # 登入、病人、檢傷、歷史、統計…
│   ├── scripts/            # 種子資料、SQL 欄位遷移
│   └── .env                # 資料庫連線（自行建立）
├── llm-backend/            # LLM FastAPI（port 8001）
│   ├── main.py
│   ├── knowledge_base.py   # Chroma 向量知識庫
│   ├── rag_pipeline.py
│   ├── requirements.txt
│   └── .env                # Gemini / Ollama 設定（自行建立）
├── scripts/
│   └── start-ipad.sh       # iPad 展示啟動檢查清單
├── vite.config.ts
├── package.json
├── .env.example            # 前端 .env 範本（可複製為 .env）
└── .env                    # 前端設定（自行建立，不進 Git）
```

---

## 12. 選用：發表展示假資料

歷史紀錄、統計分析頁需要展示用資料時：

```bash
cd api
bash scripts/seed_presentation.sh
# 或：python3 scripts/seed_demo_triage_data.py
```

完成後重新整理前端頁面即可。

---

## 13. 常見問題

| 問題 | 排查方向 |
|------|----------|
| 找不到資料庫 / 表不存在 | 是否已在 phpMyAdmin 匯入完整 `.sql` 至 MySQL（§6） |
| 帳號或密碼錯誤 | `staff` 表是否有資料；確認 §6 已匯入完整 `.sql` |
| 前端空白 / API 失敗 | 確認 8000、8001 後端是否已啟動；`.env` 埠號是否正確 |
| 資料庫連線錯誤 | XAMPP MySQL 是否啟動；`api/.env` 的 `DB_NAME`、帳密 |
| LLM 無回應 | `ollama serve` 是否執行；`ollama list` 是否有 `qwen2.5:7b-instruct` |
| `npm run dev` 報錯缺套件 | 執行 `npm install`（首次 clone 或 pull 後 package.json 有變） |
| 主訴統整很慢 / LLM 後端卡住 | 首次建 Chroma 索引；Ollama 首次載入模型，等待數分鐘 |
| iPad 無法連線 | 確認 Mac 與 iPad 同一 Wi‑Fi；使用 `npm run dev:ipad` 與 `https://` |

---

## 14. 給組員：pull 新程式碼後

若 `main` 或分支有更新，通常只需：

```bash
git pull
npm install          # 僅在 package.json 有變更時
```

**不必修改 `.env`**（除非 README 或 `.env.example` 有新增變數說明）。  
預設 `npm run dev` 即可，行為與以往相同（`http://localhost:5173` + 直連 API）。
