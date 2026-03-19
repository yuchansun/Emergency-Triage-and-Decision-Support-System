from fastapi import APIRouter
import random, string
from db import get_conn

router = APIRouter(prefix="/patients", tags=["patients"])

@router.post("/save")
async def save_patient(data: dict):
    conn = get_conn()
    try:
        id_num = data.get("id_number")
        with conn.cursor() as cur:
            p_id = None
            if id_num:
                cur.execute("SELECT patient_id FROM patients WHERE id_number = %s", (id_num,))
                row = cur.fetchone()
                if row:
                    # 修正點：兼容 dict 或 tuple 格式
                    if isinstance(row, dict):
                        p_id = row.get("patient_id")
                    else:
                        p_id = row[0]
            
            # 若無此病人，生成新 ID (P + 7位數)
            if not p_id:
                p_id = "P" + "".join(random.choices(string.digits, k=7))

            # 使用 REPLACE INTO 或 ON DUPLICATE KEY UPDATE 確保資料更新
            sql = """
                INSERT INTO patients (patient_id, name, id_number, birth_date, gender) 
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                name=VALUES(name), birth_date=VALUES(birth_date), gender=VALUES(gender)
            """
            cur.execute(sql, (p_id, data.get("name") or "匿名", id_num, data.get("birth_date"), data.get("gender")))
            conn.commit()
            
        return {"success": True, "patient_id": p_id}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()