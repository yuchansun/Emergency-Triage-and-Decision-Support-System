from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pymysql.cursors
import os
import logging

# 設置日誌記錄
logging.basicConfig(level=logging.INFO)

app = FastAPI()

# 允許跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# 資料庫連接函數
def get_conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", ""),
        db=os.getenv("DB_NAME", "triage"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )

# 根路由，避免 404 錯誤
@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI app!"}

# 取得 cc_with_counts 資料
@app.get("/cc_with_counts")
def get_cc_with_counts():
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT category, system_code, system_name, symptom_code, symptom_name, `count` FROM cc_with_counts")
            rows = cur.fetchall()
        return rows
    except pymysql.MySQLError as e:
        logging.error(f"Database query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
    finally:
        if conn:
            conn.close()

# 取得 triage_hierarchy 資料
@app.get("/triage_hierarchy")
def get_triage_hierarchy():
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT category, system_code, system_name, symptom_code, symptom_name, rule_code, judge_name, ttas_degree, nhi_degree FROM triage_hierarchy")
            rows = cur.fetchall()
        return rows
    except pymysql.MySQLError as e:
        logging.error(f"Database query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
    finally:
        if conn:
            conn.close()

# 處理 favicon.ico 請求
@app.get("/favicon.ico")
def favicon():
    return FileResponse("path/to/your/favicon.ico")
