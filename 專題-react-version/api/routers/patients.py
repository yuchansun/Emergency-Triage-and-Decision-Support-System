from fastapi import APIRouter, HTTPException, Body
import random
import pymysql
import logging
from db import get_conn as get_db_connection

router = APIRouter()

def generate_unique_patient_id(cursor):
    """在資料庫中確保生成一個不重複的 6 位數 ID"""
    for _ in range(100):
        new_id = random.randint(100000, 999999)
        cursor.execute("SELECT 1 FROM patients WHERE patient_id = %s", (new_id,))
        if not cursor.fetchone():
            return new_id
    raise Exception("無法生成唯一的病人 ID")

@router.post("/patients")
def create_patient(data: dict = Body(...)):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="資料庫連線失敗")
    
    # 💡 使用 DictCursor 確保抓到的 row 是字典格式
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    try:
        raw_id_number = str(data.get('idNumber', '')).strip()
        id_number = raw_id_number if raw_id_number else None
        
        name = str(data.get('name', '未填寫')).strip()
        birth_date = data.get('birthDate') if data.get('birthDate') else None
        gender = data.get('gender')

        # 1. 核心重複檢查
        if id_number:
            check_sql = "SELECT patient_id FROM patients WHERE id_number = %s"
            cursor.execute(check_sql, (id_number,))
            exists = cursor.fetchone()
            
            if exists:
                # 💡 攔截重複：回傳 200 並告知 exists 狀態
                return {
                    "status": "exists", 
                    "patient_id": exists['patient_id']
                }

        # 2. 如果是新病人，才生成 ID 並寫入
        new_random_id = generate_unique_patient_id(cursor)

        try:
            sql = """
                INSERT INTO patients (patient_id, name, id_number, birth_date, gender) 
                VALUES (%s, %s, %s, %s, %s)
            """
            val = (new_random_id, name, id_number, birth_date, gender)
            cursor.execute(sql, val)
            conn.commit()
        except pymysql.err.IntegrityError as e:
            # 二次防護：若 INSERT 報重複，代表 SELECT 瞬間沒抓到，此時回滾並回傳 exists
            if "Duplicate entry" in str(e):
                conn.rollback()
                cursor.execute("SELECT patient_id FROM patients WHERE id_number = %s", (id_number,))
                row = cursor.fetchone()
                return {"status": "exists", "patient_id": row['patient_id'] if row else "unknown"}
            raise e

        return {"status": "success", "patient_id": new_random_id}
        
    except Exception as e:
        if conn: conn.rollback()
        logging.error(f"❌ Patient API Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"系統錯誤: {str(e)}")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()