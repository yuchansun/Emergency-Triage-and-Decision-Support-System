from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query

from db import get_conn

router = APIRouter(prefix="/stats", tags=["stats"])


def calc_age(birth_date: Any) -> int:
    if not birth_date:
        return 0
    if isinstance(birth_date, str):
        try:
            birth_date = datetime.strptime(birth_date, "%Y-%m-%d").date()
        except ValueError:
            return 0
    today = date.today()
    return max(0, today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day)))


def normalize_triage_level(level: Any):
    if level is None:
        return "none"
    try:
        value = int(level)
    except (TypeError, ValueError):
        return "none"
    if value <= 0:
        return "none"
    if value > 5:
        return 5
    return value


def in_range(record_time: datetime, range_key: str, today: date) -> bool:
    record_date = record_time.date()
    if range_key == "today":
        return record_date == today
    if range_key == "week":
        week_start = today - timedelta(days=today.weekday())
        return week_start <= record_date <= today
    month_start = today.replace(day=1)
    return month_start <= record_date <= today


@router.get("/overview")
async def get_stats_overview(range: str = Query("month", pattern="^(today|week|month)$")):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.triage_id,
                    p.gender,
                    p.birth_date,
                    COALESCE(e.visit_time, t.created_at) AS arrival_at,
                    tragg.triage_level
                FROM triage_record t
                LEFT JOIN patients p ON p.patient_id = t.patient_id
                LEFT JOIN encounter_extra e ON e.triage_id = t.triage_id
                LEFT JOIN (
                    SELECT
                        r.triage_id,
                        MIN(h.ttas_degree) AS triage_level
                    FROM triage_result r
                    LEFT JOIN triage_hierarchy h ON h.rule_code = r.rule_code
                    GROUP BY r.triage_id
                ) tragg ON tragg.triage_id = t.triage_id
                ORDER BY arrival_at DESC
                """
            )
            rows = cur.fetchall() or []

        today = date.today()
        filtered: List[Dict[str, Any]] = []
        for row in rows:
            r = row if isinstance(row, dict) else {}
            arrival_at = r.get("arrival_at")
            if isinstance(arrival_at, str):
                try:
                    arrival_at = datetime.fromisoformat(arrival_at.replace("T", " ").replace("Z", ""))
                except ValueError:
                    continue
            if not isinstance(arrival_at, datetime):
                continue
            if not in_range(arrival_at, range, today):
                continue

            filtered.append(
                {
                    "gender": (r.get("gender") or "").upper(),
                    "age": calc_age(r.get("birth_date")),
                    "triageLevel": normalize_triage_level(r.get("triage_level")),
                }
            )

        total = len(filtered)
        male = sum(1 for item in filtered if item["gender"] == "M")
        female = sum(1 for item in filtered if item["gender"] == "F")
        avg_age = round(sum(item["age"] for item in filtered) / total, 1) if total > 0 else 0.0

        level_counts = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "none": 0}
        for item in filtered:
            key = str(item["triageLevel"])
            level_counts[key] = level_counts.get(key, 0) + 1

        age_counts = {
            "0-18": 0,
            "19-30": 0,
            "31-45": 0,
            "46-60": 0,
            "61+": 0,
        }
        for item in filtered:
            age = item["age"]
            if age <= 18:
                age_counts["0-18"] += 1
            elif age <= 30:
                age_counts["19-30"] += 1
            elif age <= 45:
                age_counts["31-45"] += 1
            elif age <= 60:
                age_counts["46-60"] += 1
            else:
                age_counts["61+"] += 1

        return {
            "success": True,
            "data": {
                "range": range,
                "total": total,
                "male": male,
                "female": female,
                "avgAge": avg_age,
                "levelCounts": level_counts,
                "ageCounts": age_counts,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取統計資料失敗: {str(e)}")
    finally:
        if conn:
            conn.close()