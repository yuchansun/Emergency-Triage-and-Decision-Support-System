from fastapi import APIRouter, HTTPException
from datetime import date, datetime
from db import get_conn

router = APIRouter(prefix="/triage-report", tags=["triage-report"])

def calc_age(birth_date):
    if not birth_date:
        return None

    if isinstance(birth_date, str):
        try:
            birth_date = datetime.strptime(birth_date, "%Y-%m-%d").date()
        except ValueError:
            return None

    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )

@router.get("/{triage_id}")
async def get_triage_report(triage_id: str):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            # 1) 先拿 triage_record + vital + encounter
            cur.execute(
                """
                SELECT
                    t.triage_id,
                    t.patient_id,
                    t.nurse_id,
                    t.created_at,

                    v.temperature,
                    v.heart_rate,
                    v.spo2,
                    v.respiratory_rate,
                    v.weight,
                    v.blood_pressure_sys,
                    v.blood_pressure_dia,
                    v.blood_sugar,
                    v.gcs_eye,
                    v.gcs_verbal,
                    v.gcs_motor,
                    v.past_medical_history,
                    v.do_not_treat,
                    v.allergy,
                    v.pain_score,
                    v.sentiment,

                    e.bed,
                    e.patient_source,
                    e.major_incident,
                    e.visit_time,
                    e.tocc_travel,
                    e.tocc_travel_start,
                    e.tocc_travel_end,
                    e.tocc_cluster_items,
                    e.tocc_cluster_other,
                    e.tocc_symptoms,
                    e.tocc_occupation,
                    e.tocc_occupation_other
                FROM triage_record t
                LEFT JOIN vital_signs v ON v.triage_id = t.triage_id
                LEFT JOIN encounter_extra e ON e.triage_id = t.triage_id
                WHERE t.triage_id = %s
                LIMIT 1
                """,
                (triage_id,)
            )
            base_row = cur.fetchone()

            if not base_row:
                raise HTTPException(status_code=404, detail="查無檢傷紀錄")

            if not isinstance(base_row, dict):
                columns = [desc[0] for desc in cur.description]
                base_row = dict(zip(columns, base_row))

            # 2) 補救 patient_id（如果 triage_record 沒寫）
            resolved_patient_id = base_row.get("patient_id")

            if not resolved_patient_id:
                # triage_id 例: MRN-20260326-273562-3D7D
                parts = (triage_id or "").split("-")
                suffix6 = parts[2] if len(parts) >= 3 else None

                if suffix6 and suffix6.isdigit() and suffix6 != "000000":
                    # 先試 P0 + 6碼
                    candidate = f"P0{suffix6}"
                    cur.execute(
                        "SELECT patient_id FROM patients WHERE patient_id = %s LIMIT 1",
                        (candidate,)
                    )
                    r = cur.fetchone()
                    if r:
                        resolved_patient_id = r["patient_id"] if isinstance(r, dict) else r[0]
                    else:
                        # 再試尾碼比對
                        cur.execute(
                            "SELECT patient_id FROM patients WHERE RIGHT(patient_id, 6) = %s LIMIT 1",
                            (suffix6,)
                        )
                        r2 = cur.fetchone()
                        if r2:
                            resolved_patient_id = r2["patient_id"] if isinstance(r2, dict) else r2[0]

            # 3) 查 patients（用補救後 patient_id）
            p_row = {}
            if resolved_patient_id:
                cur.execute(
                    """
                    SELECT
                        patient_id,
                        name,
                        id_number,
                        birth_date,
                        gender,
                        COALESCE(NULLIF(medical_number, ''), patient_id) AS medical_id
                    FROM patients
                    WHERE patient_id = %s
                    LIMIT 1
                    """,
                    (resolved_patient_id,)
                )
                p_row = cur.fetchone() or {}
                if not isinstance(p_row, dict):
                    p_cols = [desc[0] for desc in cur.description]
                    p_row = dict(zip(p_cols, p_row))

            # 4) triage_result
            cur.execute(
                """
                SELECT rule_code, chief_complaint, notes
                FROM triage_result
                WHERE triage_id = %s
                ORDER BY rule_code
                """,
                (triage_id,)
            )
            result_rows = cur.fetchall() or []

            rule_codes = []
            chief_complaints = []
            notes_list = []

            for item in result_rows:
                if not isinstance(item, dict):
                    cols = [desc[0] for desc in cur.description]
                    item = dict(zip(cols, item))
                if item.get("rule_code"):
                    rule_codes.append(item["rule_code"])
                if item.get("chief_complaint"):
                    chief_complaints.append(item["chief_complaint"])
                if item.get("notes"):
                    notes_list.append(item["notes"])

            birth_date = p_row.get("birth_date")
            data = {
                "triage_id": base_row.get("triage_id"),
                "patient_id": resolved_patient_id,
                "nurse_id": base_row.get("nurse_id"),
                "created_at": base_row.get("created_at"),

                "name": p_row.get("name"),
                "id_number": p_row.get("id_number"),
                "birth_date": birth_date,
                "gender": p_row.get("gender"),
                "age": calc_age(birth_date),
                "medical_id": p_row.get("medical_id"),

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

                "rule_code": ";".join(rule_codes),
                "chief_complaint": "\n".join(dict.fromkeys(chief_complaints)),
                "notes": "\n".join(dict.fromkeys(notes_list)),
            }

            return {"success": True, "data": data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")
    finally:
        if conn:
            conn.close()