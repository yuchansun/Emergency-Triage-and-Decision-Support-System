from fastapi import APIRouter, HTTPException
import pymysql
import logging
from db import get_conn  # ← 改這裡：用 db 而不是 database
from datetime import datetime
import secrets

router = APIRouter()
logger = logging.getLogger(__name__)

def generate_medical_number(patient_id: int | None) -> str:
    date_part = datetime.now().strftime("%Y%m%d")
    pid_part = f"{patient_id:06d}" if patient_id else "000000"
    rand_part = secrets.token_hex(2).upper()  # 4碼
    return f"MRN-{date_part}-{pid_part}-{rand_part}"

@router.post("/triagesave")
async def create_triagesave(triagesave_data: dict):
    """新增檢傷記錄"""
    conn = None  # ← 改這裡：用 conn 而不是 connection
    try:
        conn = get_conn()  # ← 改這裡
        with conn.cursor() as cur:  # ← 改這裡
            # 開始事務
            cur.execute("START TRANSACTION")
            
            patient_id = triagesave_data.get("patientId")
            nurse_id = triagesave_data.get("nurseId")

            # 先建立 triage_record
            cur.execute(
                "INSERT INTO triage_record (patient_id, nurse_id) VALUES (%s, %s)",
                (patient_id, nurse_id)
            )
            triage_id = cur.lastrowid

            # 產生/補病歷號（不用AI）
            medical_number = None
            if patient_id:
                cur.execute("SELECT medical_number FROM patients WHERE patient_id=%s", (patient_id,))
                row = cur.fetchone()
                if row:
                    current_mrn = row[0]
                    if not current_mrn:
                        medical_number = generate_medical_number(patient_id)
                        cur.execute(
                            "UPDATE patients SET medical_number=%s WHERE patient_id=%s",
                            (medical_number, patient_id)
                        )
                    else:
                        medical_number = current_mrn

            # === 2. 新增生命徵象 (vital_signs) ===
            vitals = triagesave_data.get('vitals', {})
            cur.execute(
                """INSERT INTO vital_signs (
                    triage_id, temperature, heart_rate, spo2, respiratory_rate, weight,
                    blood_pressure_sys, blood_pressure_dia, blood_sugar, gcs_eye, gcs_verbal,
                    gcs_motor, past_medical_history, do_not_treat, allergy, pain_score, sentiment
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    triage_id,
                    vitals.get('temperature'),
                    vitals.get('heart_rate'),
                    vitals.get('spo2'),
                    vitals.get('respiratory_rate'),
                    vitals.get('weight'),
                    vitals.get('blood_pressure_sys'),
                    vitals.get('blood_pressure_dia'),
                    vitals.get('blood_sugar'),
                    vitals.get('gcs_eye'),
                    vitals.get('gcs_verbal'),
                    vitals.get('gcs_motor'),
                    vitals.get('past_medical_history'),
                    vitals.get('do_not_treat'),
                    vitals.get('allergy'),
                    vitals.get('pain_score'),
                    vitals.get('sentiment'),
                )
            )
            
            # === 3. 新增檢傷結果 (triage_result) ===
            result = triagesave_data.get('result', {})
            rule_codes = [code.strip() for code in result.get('rule_code', '').split(';')] if result.get('rule_code') else []
            
            for rule_code in rule_codes:
                cur.execute(
                    "INSERT INTO triage_result (triage_id, rule_code, notes) VALUES (%s, %s, %s)",
                    (triage_id, rule_code, result.get('notes') or '')
                )
            
            # === 4. 新增就診額外資料 (encounter_extra) ===
            cur.execute(
                """INSERT INTO encounter_extra (
                    triage_id, bed, patient_source, major_incident, visit_time,
                    tocc_travel, tocc_travel_start, tocc_travel_end, tocc_occupation,
                    tocc_occupation_other, tocc_contact_items, tocc_cluster_items,
                    tocc_cluster_other, tocc_symptoms
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    triage_id,
                    triagesave_data.get('bed'),
                    triagesave_data.get('patientSource'),
                    triagesave_data.get('majorIncident'),
                    triagesave_data.get('visitTime'),
                    triagesave_data.get('tocc_travel'),
                    triagesave_data.get('tocc_travel_start'),
                    triagesave_data.get('tocc_travel_end'),
                    triagesave_data.get('tocc_occupation'),
                    triagesave_data.get('tocc_occupation_other'),
                    triagesave_data.get('tocc_contact_items'),
                    triagesave_data.get('tocc_cluster_items'),
                    triagesave_data.get('tocc_cluster_other'),
                    triagesave_data.get('tocc_symptoms'),
                )
            )
            
            # 提交事務
            conn.commit()
        
        return {
            "success": True,
            "message": "檢傷資料已儲存",
            "triageId": triage_id,
            "medicalNumber": medical_number
        }
        
    except pymysql.MySQLError as e:  # ← 改這裡
        if conn:
            conn.rollback()
        logger.error(f"新增檢傷錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=f"新增檢傷失敗: {str(e)}")
    finally:
        if conn:
            conn.close()  # ← 改這裡

@router.get("/triagesave/{triage_id}")
async def get_triagesave(triage_id: int):
    """查詢檢傷紀錄"""
    conn = None  # ← 改這裡
    try:
        conn = get_conn()  # ← 改這裡
        with conn.cursor() as cur:  # ← 改這裡
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
            
            records = cur.fetchall()  # ← 改這裡
        
        if not records:
            raise HTTPException(status_code=404, detail="檢傷紀錄不存在")
        
        return {
            "success": True,
            "data": records
        }
        
    except pymysql.MySQLError as e:  # ← 改這裡
        logger.error(f"查詢檢傷錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")
    finally:
        if conn:
            conn.close()  # ← 改這裡