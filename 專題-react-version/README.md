# 急診檢傷輔助決策系統
本專案以 **React + FastAPI + MySQL** 開發  
---
# 系統架構

前端：                後端：                資料庫：
- React              - Python             - MySQL (phpMyAdmin)
- TypeScript         - FastAPI              
- Vite               
-----------------------------------------------------------------------------
# 專案結構 (實際上順序跟下面圖示的不太一樣 且我只有放較重要在下圖 但不影響這只是參考)

專題-react-version/
│
├─ src/ # React 前端 裡面放各種元件
├─ package.json
├─ .env # 前端 API 設定
│
└─ api/  （這邊都是資料庫api處理）
    └─ routers/
    │    ├─ counts.py # cc_with_counts API
    │    └─ triagehierarchy.py # triage_hierarchy API
    │    └─(未來新增的 API 可放在這裡 ex:病人資料、病歷資料、級數...，就放這裡)
    ├─ main.py # FastAPI主程式入口 只負責：建立FastAPI app、把各個 router 掛進來...
    ├─ db.py # 資料庫連線
    └─ .env # 後端資料庫設定
│   
└─llm-backend/  （這邊都是放大語言模型相關 連結資料庫的就不要放這裡了）

-----------------------------------------------------------------------------
請先安裝以下工具：

- Node.js
- Python 3
- MySQL 或 XAMPP
- pip3
-----------------------------------------------------------------------------
# 後端設定 (FastAPI) （要連線資料庫必須在終端機先進行這個步驟）

＃進入 api 資料夾：
cd api

＃安裝 Python 套件：  （若已安裝過就省略）
pip3 install fastapi uvicorn pymysql python-dotenv

＃在api資料夾中建立 .env （若已建立過就省略）（以下是檔案內容 資料庫連線換成自己設定的） 
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=triage  (因為我的資料庫名稱是triage)
 
＃啟動後端伺服器
uvicorn main:app --reload --port 8000
（成功後會看到： Uvicorn running on http://127.0.0.1:8000）
（API測試網址： http://localhost:8000/docs）
-----------------------------------------------------------------------------
# 前端設定 (React) 

＃回到專案根目錄：
cd ..

＃安裝套件： （若已安裝過就省略）
npm install

＃建立前端 .env （這跟剛剛那個後端.env不一樣喔） （以下是檔案內容）
VITE_API_BASE_URL=http://localhost:8000

＃啟動前端
npm run dev
-----------------------------------------------------------------------------
#一個小建議
在 .gitignore 裡加：
.env
-----------------------------------------------------------------------------
# 開發流程
以後開發時需要同時啟動：

＃後端
cd api
uvicorn main:app --reload --port 8000

＃前端
cd 專題資料夾
npm run dev

