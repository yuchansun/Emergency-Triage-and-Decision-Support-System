from typing import Optional
from fastapi import APIRouter, HTTPException
import pymysql
import logging
from db import get_conn
from datetime import datetime
import secrets

router = APIRouter()
logger = logging.getLogger(__name__)

# 正確的寫法（Python 3.9 相容）
def generate_medical_number(patient_id: Optional[str]) -> str:    
    date_part = datetime.now().strftime("%Y%m%d")
    
    # 處理 patient_id，如果是字串就取最後 6 位，如果不夠就補 0
    if patient_id:
        # 移除可能非數字的字元，只留數字部分來補零，或者直接取後六位
        clean_id = str(patient_id).replace("P", "") 
        pid_part = clean_id.zfill(6)[-6:] 
    else:
        pid_part = "000000"
        
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
            # 在第62行之前加入
            do_not_treat = vitals.get("do_not_treat")
            if do_not_treat == '' or do_not_treat is None:
                do_not_treat = 0  # 或者 None，看資料庫欄位定義
 
            
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
                    do_not_treat,
                    vitals.get("allergy"),
                    vitals.get("pain_score"),
                    vitals.get("sentiment"),
                )
            )

            result = triagesave_data.get("result", {})
            rule_codes = [c.strip() for c in (result.get("rule_code") or "").split(";") if c.strip()]
            notes = result.get("notes") or ""
            chief_complaint = (result.get("chief_complaint") or triagesave_data.get("inputText") or "").strip()

            logger.info(f"[triagesave] result={result}")
            logger.info(f"[triagesave] rule_codes={rule_codes}")
            logger.info(f"[triagesave] chief_complaint={chief_complaint}")

            if rule_codes:
                for rule_code in rule_codes:
                    cur.execute(
                        "INSERT INTO triage_result (triage_id, rule_code, chief_complaint, notes) VALUES (%s, %s, %s, %s)",
                        (triage_id, rule_code, chief_complaint, notes)
                    )
            elif notes or chief_complaint:
                cur.execute(
                    "INSERT INTO triage_result (triage_id, rule_code, chief_complaint, notes) VALUES (%s, %s, %s, %s)",
                    (triage_id, None, chief_complaint, notes)
                )

            # 時間格式轉換
            visit_time = triagesave_data.get("visitTime")
            if visit_time:
                try:
                    # 處理 '2026-03-17T06:56:19.371Z' 格式
                    if visit_time.endswith('Z'):
                        visit_time = visit_time.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(visit_time.replace('Z', '+00:00'))
                    visit_time = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    visit_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            else:
                visit_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # 處理其他日期欄位的空值
            def convert_date_field(date_value):
                if not date_value or date_value == '':
                    return None
                try:
                    if date_value.endswith('Z'):
                        date_value = date_value.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                    return dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    return None

            tocc_travel_start = convert_date_field(triagesave_data.get("tocc_travel_start"))
            tocc_travel_end = convert_date_field(triagesave_data.get("tocc_travel_end"))


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
                    visit_time,
                    triagesave_data.get("tocc_travel"),
                    tocc_travel_start,
                    tocc_travel_end,
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
                    r.rule_code, r.chief_complaint, r.notes
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