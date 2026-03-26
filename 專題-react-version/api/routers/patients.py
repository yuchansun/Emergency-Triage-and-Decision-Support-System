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
        with conn.cursor() as cur:
            p_id = None
            if id_num:
                cur.execute("SELECT patient_id FROM patients WHERE id_number = %s", (id_num,))
                row = cur.fetchone()
                if row:
                    if isinstance(row, dict):
                        p_id = row.get("patient_id")
                    else:
                        p_id = row[0]

            if not p_id:
                p_id = "P" + "".join(random.choices(string.digits, k=7))

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
        conn.close()