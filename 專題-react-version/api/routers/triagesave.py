from fastapi import APIRouter, HTTPException
import pymysql
import logging
from db import get_conn
from datetime import datetime
import secrets

router = APIRouter()
logger = logging.getLogger(__name__)

def generate_medical_number(patient_id: int | None) -> str:
    date_part = datetime.now().strftime("%Y%m%d")
    pid_part = f"{patient_id:06d}" if patient_id else "000000"
    rand_part = secrets.token_hex(2).upper()
    return f"MRN-{date_part}-{pid_part}-{rand_part}"

@router.post("/triagesave")
async def create_triagesave(triagesave_data: dict):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")

            patient_id = triagesave_data.get("patientId")
            nurse_id = triagesave_data.get("nurseId")

            # 直接產生字串型 triage_id
            triage_id = None
            for _ in range(10):
                candidate = generate_medical_number(patient_id)
                cur.execute(
                    "SELECT triage_id FROM triage_record WHERE triage_id = %s",
                    (candidate,)
                )
                exists = cur.fetchone()
                if not exists:
                    triage_id = candidate
                    break

            if not triage_id:
                raise HTTPException(status_code=500, detail="triage_id 產生失敗")

            logger.info(f"[triagesave] triage_id={triage_id}")

            cur.execute(
                "INSERT INTO triage_record (triage_id, patient_id, nurse_id) VALUES (%s, %s, %s)",
                (triage_id, patient_id, nurse_id)
            )

            vitals = triagesave_data.get("vitals", {})
            cur.execute(
                """INSERT INTO vital_signs (
                    triage_id, temperature, heart_rate, spo2, respiratory_rate, weight,
                    blood_pressure_sys, blood_pressure_dia, blood_sugar, gcs_eye, gcs_verbal,
                    gcs_motor, past_medical_history, do_not_treat, allergy, pain_score, sentiment
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    triage_id,
                    vitals.get("temperature"),
                    vitals.get("heart_rate"),
                    vitals.get("spo2"),
                    vitals.get("respiratory_rate"),
                    vitals.get("weight"),
                    vitals.get("blood_pressure_sys"),
                    vitals.get("blood_pressure_dia"),
                    vitals.get("blood_sugar"),
                    vitals.get("gcs_eye"),
                    vitals.get("gcs_verbal"),
                    vitals.get("gcs_motor"),
                    vitals.get("past_medical_history"),
                    vitals.get("do_not_treat"),
                    vitals.get("allergy"),
                    vitals.get("pain_score"),
                    vitals.get("sentiment"),
                )
            )

            result = triagesave_data.get("result", {})
            rule_codes = [c.strip() for c in (result.get("rule_code") or "").split(";") if c.strip()]
            notes = result.get("notes") or ""

            logger.info(f"[triagesave] result={result}")
            logger.info(f"[triagesave] rule_codes={rule_codes}")

            if rule_codes:
                for rule_code in rule_codes:
                    cur.execute(
                        "INSERT INTO triage_result (triage_id, rule_code, notes) VALUES (%s, %s, %s)",
                        (triage_id, rule_code, notes)
                    )
            elif notes:
                cur.execute(
                    "INSERT INTO triage_result (triage_id, rule_code, notes) VALUES (%s, %s, %s)",
                    (triage_id, None, notes)
                )

            cur.execute(
                """INSERT INTO encounter_extra (
                    triage_id, bed, patient_source, major_incident, visit_time,
                    tocc_travel, tocc_travel_start, tocc_travel_end,
                    tocc_cluster_items, tocc_cluster_other, tocc_symptoms,
                    tocc_occupation, tocc_occupation_other
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    triage_id,
                    triagesave_data.get("bed"),
                    triagesave_data.get("patientSource"),
                    triagesave_data.get("majorIncident"),
                    triagesave_data.get("visitTime"),
                    triagesave_data.get("tocc_travel"),
                    triagesave_data.get("tocc_travel_start"),
                    triagesave_data.get("tocc_travel_end"),
                    triagesave_data.get("tocc_cluster_items"),
                    triagesave_data.get("tocc_cluster_other"),
                    triagesave_data.get("tocc_symptoms"),
                    triagesave_data.get("tocc_occupation"),
                    triagesave_data.get("tocc_occupation_other"),
                )
            )

            conn.commit()

        return {
            "success": True,
            "message": "檢傷資料已儲存",
            "triageId": triage_id
        }

    except pymysql.MySQLError as e:
        if conn:
            conn.rollback()
        logger.error(f"新增檢傷錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=f"新增檢傷失敗: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.get("/triagesave/{triage_id}")
async def get_triagesave(triage_id: str):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                """SELECT 
                    t.triage_id, t.patient_id, t.nurse_id,
                    v.*, 
                    e.*,
                    r.rule_code, r.notes
                FROM triage_record t
                LEFT JOIN vital_signs v ON t.triage_id = v.triage_id
                LEFT JOIN encounter_extra e ON t.triage_id = e.triage_id
                LEFT JOIN triage_result r ON t.triage_id = r.triage_id
                WHERE t.triage_id = %s""",
                (triage_id,)
            )
            records = cur.fetchall()

        if not records:
            raise HTTPException(status_code=404, detail="檢傷紀錄不存在")

        return {
            "success": True,
            "data": records
        }

    except pymysql.MySQLError as e:
        logger.error(f"查詢檢傷錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")
    finally:
        if conn:
            conn.close()