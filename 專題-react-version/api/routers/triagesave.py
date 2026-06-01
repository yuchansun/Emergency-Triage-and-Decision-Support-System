from typing import Optional
from fastapi import APIRouter, HTTPException
import pymysql
import logging
import json
from db import get_conn
from datetime import datetime
from zoneinfo import ZoneInfo
import secrets

router = APIRouter()
#錯誤日誌紀錄器
logger = logging.getLogger(__name__)
TAIPEI_TZ = ZoneInfo("Asia/Taipei")


def row_to_dict(row, cur=None):
    if isinstance(row, dict):
        return row
    if row is None:
        return {}
    if cur is not None and getattr(cur, "description", None):
        columns = [desc[0] for desc in cur.description]
        return dict(zip(columns, row))
    return {}


def fetch_triage_snapshot(cur, triage_id: str):
    cur.execute(
        """
        SELECT
            t.triage_id, t.patient_id, t.nurse_id, t.final_level, t.created_at,
            v.temperature, v.heart_rate, v.spo2, v.respiratory_rate, v.weight,
            v.blood_pressure_sys, v.blood_pressure_dia, v.blood_sugar,
            v.gcs_eye, v.gcs_verbal, v.gcs_motor, v.past_medical_history,
            v.do_not_treat, v.allergy, v.pain_score, v.sentiment,
            e.bed, e.patient_source, e.major_incident, e.visit_time,
            e.tocc_travel, e.tocc_travel_start, e.tocc_travel_end,
            e.tocc_cluster_items, e.tocc_cluster_other, e.tocc_symptoms,
            e.tocc_occupation, e.tocc_occupation_other
        FROM triage_record t
        LEFT JOIN vital_signs v ON t.triage_id = v.triage_id
        LEFT JOIN encounter_extra e ON e.triage_id = t.triage_id
        WHERE t.triage_id = %s
        LIMIT 1
        """,
        (triage_id,)
    )
    base_row = row_to_dict(cur.fetchone(), cur)
    if not base_row:
        return None

    cur.execute(
        """
        SELECT rule_code, chief_complaint, original_transcript
        FROM triage_result
        WHERE triage_id = %s
        ORDER BY rule_code
        """,
        (triage_id,)
    )
    result_rows = []
    for row in cur.fetchall() or []:
        d = row_to_dict(row, cur)
        result_rows.append({
            "rule_code": d.get("rule_code"),
            "chief_complaint": d.get("chief_complaint"),
            "original_transcript": d.get("original_transcript"),
        })

    return {
        "triage_record": {
            "triage_id": base_row.get("triage_id"),
            "patient_id": base_row.get("patient_id"),
            "nurse_id": base_row.get("nurse_id"),
            "final_level": base_row.get("final_level"),
            "created_at": base_row.get("created_at"),
        },
        "vital_signs": {
            "temperature": base_row.get("temperature"),
            "heart_rate": base_row.get("heart_rate"),
            "spo2": base_row.get("spo2"),
            "respiratory_rate": base_row.get("respiratory_rate"),
            "weight": base_row.get("weight"),
            "blood_pressure_sys": base_row.get("blood_pressure_sys"),
            "blood_pressure_dia": base_row.get("blood_pressure_dia"),
            "blood_sugar": base_row.get("blood_sugar"),
            "gcs_eye": base_row.get("gcs_eye"),
            "gcs_verbal": base_row.get("gcs_verbal"),
            "gcs_motor": base_row.get("gcs_motor"),
            "past_medical_history": base_row.get("past_medical_history"),
            "do_not_treat": base_row.get("do_not_treat"),
            "allergy": base_row.get("allergy"),
            "pain_score": base_row.get("pain_score"),
            "sentiment": base_row.get("sentiment"),
        },
        "encounter_extra": {
            "bed": base_row.get("bed"),
            "patient_source": base_row.get("patient_source"),
            "major_incident": base_row.get("major_incident"),
            "visit_time": base_row.get("visit_time"),
            "tocc_travel": base_row.get("tocc_travel"),
            "tocc_travel_start": base_row.get("tocc_travel_start"),
            "tocc_travel_end": base_row.get("tocc_travel_end"),
            "tocc_cluster_items": base_row.get("tocc_cluster_items"),
            "tocc_cluster_other": base_row.get("tocc_cluster_other"),
            "tocc_symptoms": base_row.get("tocc_symptoms"),
            "tocc_occupation": base_row.get("tocc_occupation"),
            "tocc_occupation_other": base_row.get("tocc_occupation_other"),
        },
        "triage_result": result_rows,
    }


def dump_json(value):
    return json.dumps(value, ensure_ascii=False, default=str, sort_keys=True)


def build_changed_snapshot(old_value, new_value):
    if old_value == new_value:
        return None

    if isinstance(old_value, dict) and isinstance(new_value, dict):
        changed_old = {}
        changed_new = {}
        for key in sorted(set(old_value.keys()) | set(new_value.keys())):
            child = build_changed_snapshot(old_value.get(key), new_value.get(key))
            if child is not None:
                child_old, child_new = child
                changed_old[key] = child_old
                changed_new[key] = child_new
        if changed_old or changed_new:
            return changed_old, changed_new
        return None

    if isinstance(old_value, list) and isinstance(new_value, list):
        return old_value, new_value

    return old_value, new_value

#生成唯一的 triage_id（醫療紀錄號碼）
def generate_medical_number(patient_id: Optional[str]) -> str:    
    date_part = datetime.now().strftime("%Y%m%d")
    
    # 處理 patient_id，如果是字串就取最後 6 位，如果不夠就補 0
    if patient_id:
        # 移除可能非數字的字元，只留數字部分來補零，或者直接取後六位
        clean_id = str(patient_id).replace("P", "") 
        pid_part = clean_id.zfill(6)[-6:] 
    else:
        pid_part = "000000"
    # 生成4位隨機十六進位數字，確保每次生成的triage_id都不一樣
    rand_part = secrets.token_hex(2).upper()
    return f"MRN-{date_part}-{pid_part}-{rand_part}"

@router.post("/triagesave")
async def create_triagesave(triagesave_data: dict):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")

            #️從前端資料中提取 patient_id、nurse_id 和 triage_id，並確保 patient_id 不為空
            patient_id = triagesave_data.get("patientId") or triagesave_data.get("patient_id")
            nurse_id = triagesave_data.get("nurseId") or triagesave_data.get("nurse_id")
            triage_id = triagesave_data.get("triage_id") or triagesave_data.get("triageId")

            if not patient_id:
                raise HTTPException(status_code=400, detail="patient_id 不可為空")

            # ✅ 若前端沒帶 triage_id 才新產生
            if not triage_id:
                for _ in range(10):
                    candidate = generate_medical_number(patient_id)
                    cur.execute("SELECT triage_id FROM triage_record WHERE triage_id = %s", (candidate,))
                    if not cur.fetchone():
                        triage_id = candidate
                        break
                if not triage_id:
                    raise HTTPException(status_code=500, detail="triage_id 產生失敗")

            cur.execute("SELECT 1 FROM triage_record WHERE triage_id = %s LIMIT 1", (triage_id,))
            record_exists = bool(cur.fetchone())
            old_snapshot = fetch_triage_snapshot(cur, triage_id) if record_exists else None

            # --- 新增 final_level 儲存邏輯到 triage_record ---
            # 相容兩種前端格式：selectedLevel（頂層）或 result.selectedLevel
            result_data = triagesave_data.get("result") or {}
            final_level = triagesave_data.get("selectedLevel") or result_data.get("selectedLevel")
            system_recommended_level = triagesave_data.get("worstSelectedDegree")

            # 確保 final_level 的儲存邏輯正確
            if system_recommended_level is not None and final_level == system_recommended_level:
                final_level = None

            # ✅ 同一 triage_id: 更新，不新增第二筆，並更新 final_level
            cur.execute(
                """
                INSERT INTO triage_record (triage_id, patient_id, nurse_id, final_level)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  patient_id = VALUES(patient_id),
                  nurse_id = VALUES(nurse_id),
                  final_level = VALUES(final_level)
                """,
                (triage_id, patient_id, nurse_id, final_level)
            )

            #vital_signs：先刪舊再寫新，避免同 triage_id 多筆 ---
            cur.execute("DELETE FROM vital_signs WHERE triage_id = %s", (triage_id,))
            vitals = triagesave_data.get("vitals", {})
            do_not_treat = vitals.get("do_not_treat")
            if do_not_treat == '' or do_not_treat is None:
                do_not_treat = 0

            cur.execute(
                """INSERT INTO vital_signs (
                    triage_id, temperature, heart_rate, spo2, respiratory_rate, weight,
                    blood_pressure_sys, blood_pressure_dia, blood_sugar, gcs_eye, gcs_verbal,
                    gcs_motor, past_medical_history, do_not_treat, allergy, pain_score, sentiment
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    triage_id,
                    vitals.get("temperature"), vitals.get("heart_rate"), vitals.get("spo2"),
                    vitals.get("respiratory_rate"), vitals.get("weight"),
                    vitals.get("blood_pressure_sys"), vitals.get("blood_pressure_dia"),
                    vitals.get("blood_sugar"), vitals.get("gcs_eye"), vitals.get("gcs_verbal"),
                    vitals.get("gcs_motor"), vitals.get("past_medical_history"),
                    do_not_treat, vitals.get("allergy"), vitals.get("pain_score"), vitals.get("sentiment"),
                )
            )

            # --- triage_result：先刪舊再寫新 ---
            cur.execute("DELETE FROM triage_result WHERE triage_id = %s", (triage_id,))
            result = triagesave_data.get("result", {})
            rule_codes = [c.strip() for c in (result.get("rule_code") or "").split(";") if c.strip()]
            chief_complaint = (result.get("chief_complaint") or triagesave_data.get("inputText") or "").strip()
            original_transcript = (result.get("original_transcript") or "").strip() or None

            if rule_codes:
                for rule_code in rule_codes:
                    cur.execute(
                        "INSERT INTO triage_result (triage_id, rule_code, chief_complaint, original_transcript) VALUES (%s, %s, %s, %s)",
                        (triage_id, rule_code, chief_complaint, original_transcript)
                    )
            elif chief_complaint:
                cur.execute(
                    "INSERT INTO triage_result (triage_id, rule_code, chief_complaint, original_transcript) VALUES (%s, %s, %s, %s)",
                    (triage_id, None, chief_complaint, original_transcript)
                )

            # --- encounter_extra：先刪舊再寫新 ---
            cur.execute("DELETE FROM encounter_extra WHERE triage_id = %s", (triage_id,))
            # 時間格式轉換
            visit_time = triagesave_data.get("visitTime")
            if visit_time:
                try:
                    # 將前端送來的 UTC 時間轉成台灣時間再存入資料庫
                    visit_time_text = str(visit_time).strip()
                    if visit_time_text.endswith('Z'):
                        visit_time_text = visit_time_text.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(visit_time_text)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=TAIPEI_TZ)
                    else:
                        dt = dt.astimezone(TAIPEI_TZ)
                    visit_time = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    visit_time = datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d %H:%M:%S')
            else:
                visit_time = datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d %H:%M:%S')

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

            # 將encounter_extra的資料寫入資料庫
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

            if record_exists:
                new_snapshot = fetch_triage_snapshot(cur, triage_id)
                changed_snapshot = build_changed_snapshot(old_snapshot, new_snapshot) if old_snapshot is not None and new_snapshot is not None else None
                if changed_snapshot is not None:
                    staff_id_raw = nurse_id or triagesave_data.get("staffId")
                    try:
                        staff_id = int(str(staff_id_raw).strip())
                    except (TypeError, ValueError):
                        raise HTTPException(status_code=400, detail="staff_id 不合法，無法寫入修改紀錄")

                    old_data, new_data = changed_snapshot

                    cur.execute(
                        """
                        INSERT INTO modification_logs (
                            staff_id, action_type, target_table, target_record_id,
                            old_data, new_data
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            staff_id,
                            "UPDATE",
                            "triage_record",
                            triage_id,
                            dump_json(old_data),
                            dump_json(new_data),
                        )
                    )
            else:
                new_snapshot = fetch_triage_snapshot(cur, triage_id)
                if new_snapshot is not None:
                    staff_id_raw = nurse_id or triagesave_data.get("staffId")
                    try:
                        staff_id = int(str(staff_id_raw).strip())
                    except (TypeError, ValueError):
                        raise HTTPException(status_code=400, detail="staff_id 不合法，無法寫入修改紀錄")

                    cur.execute(
                        """
                        INSERT INTO modification_logs (
                            staff_id, action_type, target_table, target_record_id,
                            old_data, new_data
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            staff_id,
                            "INSERT",
                            "triage_record",
                            triage_id,
                            dump_json({}),
                            dump_json(new_snapshot),
                        )
                    )

            conn.commit()

        return {"success": True, "message": "檢傷資料已儲存", "triageId": triage_id}

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
                    r.rule_code, r.chief_complaint
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