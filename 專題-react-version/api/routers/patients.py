from fastapi import APIRouter, HTTPException
import random, string
from datetime import date, datetime
from db import get_conn

router = APIRouter(prefix="/patients", tags=["patients"])

def calc_age(birth_date):
    if not birth_date:
        return None

    if isinstance(birth_date, str):
        try:
            birth_date = datetime.strptime(birth_date, "%Y-%m-%d").date()
        except ValueError:
            return None

    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


@router.post("/save")
async def save_patient(data: dict):
    conn = get_conn()
    try:
        id_num = data.get("id_number")
        p_id = None
        is_returning = False  # 預設為新病人

        with conn.cursor() as cur:
            # 1. 檢查是否以前來過 (只有在有填身分證時才檢查)
            if id_num and id_num.strip():
                cur.execute("SELECT patient_id FROM patients WHERE id_number = %s", (id_num,))
                row = cur.fetchone()
                if row:
                    is_returning = True # 標記為舊病人
                    p_id = row.get("patient_id") if isinstance(row, dict) else row[0]

            # 2. 如果沒查到紀錄 (新病人或沒填身分證)，生成新 ID
            if not p_id:
                p_id = "P" + "".join(random.choices(string.digits, k=7))

            # 3. 執行資料存檔 (使用 ON DUPLICATE KEY UPDATE 確保重複時更新資料)
            sql = """
                INSERT INTO patients (patient_id, name, id_number, birth_date, gender) 
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                name=VALUES(name), birth_date=VALUES(birth_date), gender=VALUES(gender)
            """
            cur.execute(sql, (
                p_id, 
                data.get("name") or "匿名", 
                id_num if id_num and id_num.strip() else None, 
                data.get("birth_date"), 
                data.get("gender")
            ))
            conn.commit()
            
        # 4. 組合掛號成功的提示訊息
        status_label = "【回診】" if is_returning else "【初診】"
        display_msg = f"掛號成功！{status_label} 病人 ID: {p_id}"

        return {
            "success": True, 
            "patient_id": p_id, 
            "is_returning": is_returning,
            "message": display_msg
        }

    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/{patient_id}")
async def get_patient(patient_id: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p.patient_id,
                    p.name,
                    p.id_number,
                    p.birth_date,
                    p.gender,
                    COALESCE(NULLIF(p.medical_number, ''), p.patient_id) AS medical_id,
                    (
                        SELECT tr.triage_id
                        FROM triage_record tr
                        WHERE tr.patient_id = p.patient_id
                        ORDER BY tr.created_at DESC
                        LIMIT 1
                    ) AS visit_number
                FROM patients p
                WHERE p.patient_id = %s
            """, (patient_id,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="查無病患資料")

            if isinstance(row, dict):
                data = row
            else:
                columns = [desc[0] for desc in cur.description]
                data = dict(zip(columns, row))

            data["age"] = calc_age(data.get("birth_date"))

            return {
                "success": True,
                "data": data
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn: conn.close()

@router.get("/search/{id_number}")
async def search_patient(id_number: str):
    """供前端輸入身分證時即時查詢使用"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            sql = "SELECT patient_id, name, birth_date, gender FROM patients WHERE id_number = %s"
            cur.execute(sql, (id_number,))
            row = cur.fetchone()

            if row:
                if isinstance(row, dict):
                    patient_data = row
                else:
                    patient_data = {
                        "patient_id": row[0],
                        "name": row[1],
                        "birth_date": str(row[2]) if row[2] else None,
                        "gender": row[3]
                    }
                return {"found": True, "data": patient_data, "message": "偵測到舊病人資料"}
            return {"found": False, "message": "新病人"}
    finally:
        if conn: conn.close()