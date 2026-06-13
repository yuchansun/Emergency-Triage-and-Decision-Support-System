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
        if isinstance(id_num, str):
            id_num = id_num.strip().upper()
        p_id = None
        is_returning = False  # 預設為新病人

        with conn.cursor() as cur:
            # 1. 檢查是否以前來過 (只有在有填身分證時才檢查)
            if id_num and id_num.strip():
                normalized_id = id_num.strip().upper()
                cur.execute("SELECT patient_id FROM patients WHERE TRIM(UPPER(id_number)) = %s", (normalized_id,))
                row = cur.fetchone()
                if row:
                    is_returning = True # 標記為舊病人
                    p_id = row.get("patient_id") if isinstance(row, dict) else row[0]

            # 2. 如果沒查到紀錄 (新病人或沒填身分證)，生成新 ID
            if not p_id:
                p_id = "P" + "".join(random.choices(string.digits, k=7))

            # 3. 執行資料存檔 (使用 ON DUPLICATE KEY UPDATE 確保重複時更新資料)
            sql = """
                INSERT INTO patients (patient_id, name, id_number, birth_date, gender, drug_allergy)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                name=VALUES(name),
                id_number=VALUES(id_number),
                birth_date=VALUES(birth_date),
                gender=VALUES(gender),
                drug_allergy=COALESCE(VALUES(drug_allergy), drug_allergy)
            """
            birth_date = data.get("birth_date")
            if birth_date is not None and str(birth_date).strip() == "":
                birth_date = None

            cur.execute(sql, (
                p_id,
                data.get("name") or "匿名",
                id_num if id_num and id_num.strip() else None,
                birth_date,
                data.get("gender"),
                data.get("drug_allergy")
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


@router.get("/search/{id_number}")
async def search_patient_by_id_number(id_number: str):
    """依身分證字號查詢（掛號頁讀卡／手輸後帶出舊資料）。"""
    conn = get_conn()
    try:
        lookup_value = (id_number or "").strip().upper()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.patient_id,
                    p.name,
                    p.id_number,
                    p.birth_date,
                    p.gender,
                    p.drug_allergy,
                    COALESCE(NULLIF(p.medical_number, ''), p.patient_id) AS medical_id,
                    (
                        SELECT tr.triage_id
                        FROM triage_record tr
                        WHERE tr.patient_id = p.patient_id
                        ORDER BY tr.created_at DESC
                        LIMIT 1
                    ) AS visit_number
                FROM patients p
                WHERE TRIM(UPPER(COALESCE(p.id_number, ''))) = %s
                   OR TRIM(UPPER(COALESCE(p.medical_number, ''))) = %s
                   OR TRIM(UPPER(COALESCE(p.patient_id, ''))) = %s
                LIMIT 1
                """,
                (lookup_value, lookup_value, lookup_value),
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="查無病患資料")

            if isinstance(row, dict):
                data = row
            else:
                columns = [desc[0] for desc in cur.description]
                data = dict(zip(columns, row))

            data["age"] = calc_age(data.get("birth_date"))

            return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
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
                    p.drug_allergy,
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