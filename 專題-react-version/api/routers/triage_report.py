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
                    t.final_level,  -- 務必加入這個欄位
                    s.name AS nurse_name,
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
                LEFT JOIN staff s ON s.nurse_id = t.nurse_id
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
                SELECT rule_code, chief_complaint
                FROM triage_result
                WHERE triage_id = %s
                ORDER BY rule_code
                """,
                (triage_id,)
            )
            result_rows = cur.fetchall() or []

            rule_codes = []
            chief_complaints = []

            for item in result_rows:
                if not isinstance(item, dict):
                    cols = [desc[0] for desc in cur.description]
                    item = dict(zip(cols, item))
                if item.get("rule_code"):
                    rule_codes.append(item["rule_code"])
                if item.get("chief_complaint"):
                    chief_complaints.append(item["chief_complaint"])

            # 4-1) 由 rule_code -> triage_hierarchy.ttas_degree 取得檢傷級數（最嚴重取 MIN）
            triage_level = None
            cur.execute(
                """
                SELECT MIN(h.ttas_degree) AS triage_level
                FROM triage_result r
                JOIN triage_hierarchy h ON h.rule_code = r.rule_code
                WHERE r.triage_id = %s
                  AND h.ttas_degree IS NOT NULL
                """,
                (triage_id,)
            )
            lv_row = cur.fetchone()
            if lv_row:
                if isinstance(lv_row, dict):
                    triage_level = lv_row.get("triage_level")
                else:
                    triage_level = lv_row[0]

            # 4-2) 由 rule_code 取得 症狀 + 判斷規則
            cur.execute(
                """
                SELECT DISTINCT
                    h.symptom_name,
                    h.judge_name
                FROM triage_result r
                JOIN triage_hierarchy h ON h.rule_code = r.rule_code
                WHERE r.triage_id = %s
                  AND h.symptom_name IS NOT NULL
                  AND h.judge_name IS NOT NULL
                ORDER BY h.ttas_degree ASC, h.symptom_name ASC
                """,
                (triage_id,)
            )
            symptom_rule_rows = cur.fetchall() or []
            symptom_rule_pairs = []
            for row in symptom_rule_rows:
                if not isinstance(row, dict):
                    cols = [desc[0] for desc in cur.description]
                    row = dict(zip(cols, row))
                symptom_name = (row.get("symptom_name") or "").strip()
                judge_name = (row.get("judge_name") or "").strip() #
                if symptom_name and judge_name:
                    symptom_rule_pairs.append(
                        {
                            "symptom_name": symptom_name,
                            "judge_name": judge_name,
                        }
                    )
            # 在組裝 data 字典之前（約第 140 行）加入這段邏輯：

            # 1. 取得兩個來源的級數
            raw_final = base_row.get("final_level")  # 護理師手改的
            raw_rule = triage_level                 # 系統規則算的

            # 2. 執行優先級判定：如果有 final_level 就用它，沒有才用 rule 算的[cite: 1]
            # 注意：要排除 None 和空字串，但保留數字 0[cite: 1]
            if raw_final is not None and str(raw_final).strip() != "":
                effective_level = raw_final
            else:
                effective_level = raw_rule

            # 3. 處理「0 轉 1」的業務需求：如果是 0 級（直入），前端顯示為第 1 級[cite: 1]
            if effective_level is not None:
                try:
                    level_int = int(effective_level)
                    final_display_level = 1 if level_int == 0 else level_int
                except (ValueError, TypeError):
                    final_display_level = effective_level
            else:
                final_display_level = None

            birth_date = p_row.get("birth_date")
            data = {
                "triage_id": base_row.get("triage_id"),
                "patient_id": resolved_patient_id,
                "nurse_id": base_row.get("nurse_id"),
                "created_at": base_row.get("created_at"),
                "triage_level": final_display_level,

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
                "symptom_rule_pairs": symptom_rule_pairs,
                "nurse_name": base_row.get("nurse_name"),
            }

            return {"success": True, "data": data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")
    finally:
        if conn:
            conn.close()