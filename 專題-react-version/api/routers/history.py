from datetime import date, datetime
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query

from db import get_conn

router = APIRouter(prefix="/history", tags=["history"])


def calc_age(birth_date: Any) -> Optional[int]:
    if not birth_date:
        return None
    if isinstance(birth_date, str):
        try:
            birth_date = datetime.strptime(birth_date, "%Y-%m-%d").date()
        except ValueError:
            return None

    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def normalize_triage_level(value: Any) -> int:
    if value is None:
        return 5
    try:
        level = int(value)
    except (TypeError, ValueError):
        return 5
    if level <= 0:
        return 1
    if level >= 5:
        return 5
    return level


def build_where_clause(
    keyword: Optional[str],
    from_date: Optional[str],
    to_date: Optional[str],
    gender: Optional[str],
    birth_from: Optional[str],
    birth_to: Optional[str],
    triage_level: Optional[int],
) -> Tuple[str, List[Any]]:
    clauses: List[str] = []
    params: List[Any] = []

    if keyword:
        kw = f"%{keyword.strip()}%"
        clauses.append(
            """(
                p.name LIKE %s
                OR p.patient_id LIKE %s
                OR t.triage_id LIKE %s
                OR p.id_number LIKE %s
                OR COALESCE(tragg.chief_complaint, '') LIKE %s
                OR COALESCE(e.tocc_symptoms, '') LIKE %s
            )"""
        )
        params.extend([kw, kw, kw, kw, kw, kw])

    if from_date:
        clauses.append("DATE(COALESCE(e.visit_time, t.created_at)) >= %s")
        params.append(from_date)

    if to_date:
        clauses.append("DATE(COALESCE(e.visit_time, t.created_at)) <= %s")
        params.append(to_date)

    if gender:
        clauses.append("p.gender = %s")
        params.append(gender)

    if birth_from:
        clauses.append("p.birth_date >= %s")
        params.append(birth_from)

    if birth_to:
        clauses.append("p.birth_date <= %s")
        params.append(birth_to)

    if triage_level:
        clauses.append("tragg.triage_level = %s")
        params.append(triage_level)

    if not clauses:
        return "", params

    return "WHERE " + " AND ".join(clauses), params


@router.get("/records")
async def get_history_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    birth_from: Optional[str] = Query(None),
    birth_to: Optional[str] = Query(None),
    triage_level: Optional[int] = Query(None, ge=1, le=5),
):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            base_from = """
                FROM triage_record t
                LEFT JOIN patients p ON p.patient_id = t.patient_id
                LEFT JOIN encounter_extra e ON e.triage_id = t.triage_id
                LEFT JOIN (
                    SELECT
                        r.triage_id,
                        MIN(h.ttas_degree) AS triage_level,
                        GROUP_CONCAT(DISTINCT COALESCE(r.chief_complaint, '') SEPARATOR ' ') AS chief_complaint
                    FROM triage_result r
                    LEFT JOIN triage_hierarchy h ON h.rule_code = r.rule_code
                    GROUP BY r.triage_id
                ) tragg ON tragg.triage_id = t.triage_id
            """
            where_clause, params = build_where_clause(
                keyword=keyword,
                from_date=from_date,
                to_date=to_date,
                gender=gender,
                birth_from=birth_from,
                birth_to=birth_to,
                triage_level=triage_level,
            )

            count_sql = f"SELECT COUNT(*) AS total {base_from} {where_clause}"
            cur.execute(count_sql, params)
            count_row = cur.fetchone() or {"total": 0}
            total = count_row["total"] if isinstance(count_row, dict) else count_row[0]

            offset = (page - 1) * page_size
            data_sql = f"""
                SELECT
                    t.triage_id,
                    p.patient_id,
                    p.name,
                    p.gender,
                    p.birth_date,
                    p.id_number,
                    tragg.triage_level AS triage_level,
                    COALESCE(tragg.chief_complaint, '') AS chief_complaint_note,
                    COALESCE(e.tocc_symptoms, '') AS final_symptoms_raw,
                    COALESCE(e.visit_time, t.created_at) AS arrival_at,
                    t.nurse_id
                {base_from}
                {where_clause}
                ORDER BY COALESCE(e.visit_time, t.created_at) DESC
                LIMIT %s OFFSET %s
            """
            cur.execute(data_sql, [*params, page_size, offset])
            rows = cur.fetchall() or []

            records = []
            for row in rows:
                r = row if isinstance(row, dict) else {}
                birth_date = r.get("birth_date")
                final_symptoms_raw = r.get("final_symptoms_raw") or ""
                triage_level = r.get("triage_level")
                records.append(
                    {
                        "triageId": r.get("triage_id"),
                        "patientId": r.get("patient_id"),
                        "name": r.get("name"),
                        "gender": r.get("gender") or "",
                        "birthday": str(birth_date) if birth_date else "",
                        "age": calc_age(birth_date),
                        "idNumber": r.get("id_number") or "",
                        "triageLevel": "none" if triage_level is None else normalize_triage_level(triage_level),
                        "chiefComplaintNote": r.get("chief_complaint_note") or "",
                        "finalSymptoms": [s.strip() for s in final_symptoms_raw.split(",") if s.strip()],
                        "arrivalAt": str(r.get("arrival_at") or ""),
                        "nurseId": r.get("nurse_id") or "",
                    }
                )

            return {
                "success": True,
                "data": records,
                "pagination": {
                    "page": page,
                    "pageSize": page_size,
                    "total": total,
                    "totalPages": (total + page_size - 1) // page_size if total else 1,
                },
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查詢過去病史失敗: {str(e)}")
    finally:
        if conn:
            conn.close()
