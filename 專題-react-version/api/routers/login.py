from fastapi import APIRouter, HTTPException, Body
import sys
import os

# 確保能找到父目錄的 db.py (沿用你的設定)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_conn as get_db_connection

router = APIRouter()

@router.post("/login")
def login(data: dict = Body(...)):
    """
    登入驗證 API
    接收格式: {"username": "xxx", "password": "xxx"}
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="資料庫連線失敗")
    
    cursor = None
    try:
        # 使用 pymysql 建立 cursor
        cursor = conn.cursor()
        
        # 1. 執行查詢使用者的 SQL (對齊你 users 資料表的欄位)
        # 假設你的資料表欄位是 username, password, full_name
        sql = "SELECT full_name, password FROM users WHERE username = %s"
        cursor.execute(sql, (data.get('username'),))
        user = cursor.fetchone() # 拿到的會是字典 {'full_name': '...', 'password': '...'}

        # 2. 驗證逻辑
        if user:
            # 檢查密碼 (目前為明文比對)
            if user['password'] == data.get('password'):
                return {
                    "status": "success", 
                    "user": user['full_name']
                }
        
        # 3. 驗證失敗
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
        
    except HTTPException as he:
        # 直接拋出已經定義好的 HTTPException
        raise he
    except Exception as e:
        print(f"❌ 登入 SQL 執行錯誤: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # 確保關閉連線
        if cursor:
            cursor.close()
        if conn:
            conn.close()