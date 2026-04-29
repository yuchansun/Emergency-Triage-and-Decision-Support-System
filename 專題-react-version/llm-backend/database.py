import mysql.connector
from mysql.connector import Error

def get_db_connection():
    """ 建立並回傳資料庫連線物件 """
    # 目前是本機 XAMPP 預設設定，部署時建議改成環境變數
    try:
        connection = mysql.connector.connect(
            host='localhost',          # XAMPP 預設
            user='root',               # XAMPP 預設
            password='',               # XAMPP 預設為空
            database='medical_triage_system', # 你的資料庫名稱
            charset='utf8mb4'
        )
        if connection.is_connected():
            return connection
    except Error as e:
        print(f"❌ 資料庫連線失敗: {e}")
        return None

def fetch_all(query, params=None):
    """ 通用的查詢函數，直接回傳 list[dict] 格式 """
    conn = get_db_connection()
    if not conn: return []
    
    try:
        # dictionary=True 讓上層可用欄位名取值，不用記索引
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())
        result = cursor.fetchall()
        return result
    finally:
        cursor.close()
        conn.close()