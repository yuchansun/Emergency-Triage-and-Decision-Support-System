from fastapi import APIRouter, HTTPException, Body
import pymysql
import logging
from datetime import datetime
from db import get_conn

router = APIRouter()

# ... 你原本的 get_triage_hierarchy 保持不變 ...

@router.post("/triage/save")
def save_triage(data: dict = Body(...)):
    conn = None
    try:
        conn = get_conn()
        # 這裡一定要使用 DictCursor，方便我們讀取最新 ID
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            
            # --- 1. 自動生成流水號 (ER + 年月 + 4位數) ---
            prefix = "ER" + datetime.now().strftime("%y%m")
            # 找出當月最大的一筆序號
            cur.execute(
                "SELECT triage_id FROM triage_records WHERE triage_id LIKE %s ORDER BY triage_id DESC LIMIT 1", 
                (f"{prefix}%",)
            )
            latest = cur.fetchone()
            
            new_seq = 1
            if latest and latest['triage_id']:
                # 取得最後四碼並加 1
                try:
                    new_seq = int(latest['triage_id'][-4:]) + 1
                except:
                    new_seq = 1
            
            new_triage_id = f"{prefix}{new_seq:04d}"

            # --- 2. 執行插入 (補上 triage_id 欄位) ---
            sql = """
                INSERT INTO triage_records 
                (triage_id, patient_id, nurse_id, system_name, symptom_name, ttas_degree, nhi_degree) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cur.execute(sql, (
                new_triage_id,
                data.get('patient_id'),
                data.get('nurse_id', 1), # 預設護理師 ID 為 1
                data.get('system_name', '未分類'),
                data.get('symptom_name', '無症狀'),
                data.get('ttas_degree', 5),
                data.get('nhi_degree', 4)
            ))
            
            conn.commit()
            
            return {
                "status": "success", 
                "triage_id": new_triage_id,
                "message": "掛號成功"
            }
            
    except Exception as e:
        if conn:
            conn.rollback()
        logging.error(f"Save error: {str(e)}")
        # 這裡拋出詳細錯誤，方便你檢查是不是欄位名稱打錯
        raise HTTPException(status_code=500, detail=f"資料庫錯誤: {str(e)}")
    finally:
        if conn:
            conn.close()