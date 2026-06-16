#!/usr/bin/env python3
"""
產生檢傷展示用假資料（檢傷號格式與正式資料相同：MRN-YYYYMMDD-xxxxxx-XXXX）。
到院時間僅分布在過去至「執行當下」，不會產生未來時段。

發表當天直接執行本檔即可（會自動替換上次由本腳本產生的資料）：
  python3 專題-react-version/api/scripts/seed_demo_triage_data.py

或在 api 目錄：
  python3 scripts/seed_demo_triage_data.py

參數：
  --count 100    產生筆數（預設 100）
  --no-clear     不清除舊展示資料，直接追加（一般不需要）
"""

from __future__ import annotations

import argparse
import os
import random
import secrets
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

# 讓 script 從任意路徑執行時都能連到 api/db.py
API_DIR = Path(__file__).resolve().parent.parent
os.chdir(API_DIR)
sys.path.insert(0, str(API_DIR))

from db import get_conn  # noqa: E402

TODAY = date.today()
NOW = datetime.now()

SURNAMES = ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊", "許", "鄭", "謝", "洪", "郭"]
GIVEN_M = ["志明", "建宏", "俊傑", "冠宇", "家豪", "承恩", "柏翰", "宇軒", "信宏", "政豪"]
GIVEN_F = ["雅婷", "怡君", "佳穎", "淑芬", "美玲", "欣怡", "佩珊", "詩涵", "宜蓁", "惠如"]
GIVEN_CHILD = ["小宇", "安安", "妞妞", "阿寶", "樂樂", "萱萱", "承承", "心心"]

PAST_HISTORY = [
    "高血壓",
    "糖尿病",
    "氣喘",
    "COPD",
    "心臟病",
    "腎臟病",
    "中風病史",
    "甲狀腺疾病",
    "",
]

ALLERGIES = ["無", "無", "無", "不詳", "Penicillin", "Aspirin", "磺胺類", "海鮮"]

PATIENT_SOURCES = ["自行就醫", "119", "轉診", "警察送達", ""]

# 各級常見主訴與 rule_code（取自 triage_hierarchy）
CASE_TEMPLATES: Dict[int, List[Dict[str, str]]] = {
    1: [
        {"rule_code": "A020203", "symptom": "胸痛/胸悶", "judge": "無意識(GCS3-8)", "complaint": "突然胸痛後意識不清，冒冷汗"},
        {"rule_code": "A010103", "symptom": "呼吸短促", "judge": "無意識(GCS3-8)", "complaint": "嚴重呼吸困難，反應遲鈍"},
        {"rule_code": "A020101", "symptom": "心跳停止", "judge": "心跳停止", "complaint": "到院前心跳停止，CPR 中"},
        {"rule_code": "A010702", "symptom": "過敏反應", "judge": "休克", "complaint": "吃海鮮後全身蕁麻疹、呼吸喘、血壓偏低"},
    ],
    2: [
        {"rule_code": "A020211", "symptom": "胸痛/胸悶", "judge": "急性撕裂性疼痛", "complaint": "胸悶胸痛放射至左肩，冒冷汗"},
        {"rule_code": "A130206", "symptom": "發燒/畏寒", "judge": "血行動力循環不足", "complaint": "高燒 39 度，精神差，血壓偏低"},
        {"rule_code": "P030110", "symptom": "腹痛", "judge": "重度疼痛(8-10)", "complaint": "右下腹痛，無法行走，疼痛 9 分"},
        {"rule_code": "A010104", "symptom": "呼吸短促", "judge": "中度呼吸窘迫(＜92%)", "complaint": "喘得很厲害，血氧 90% 左右"},
    ],
    3: [
        {"rule_code": "A130212", "symptom": "發燒/畏寒", "judge": "血行動力穩定但異常", "complaint": "發燒兩天，食慾差，生命徵象尚可"},
        {"rule_code": "P030111", "symptom": "腹痛", "judge": "急性中樞中度疼痛(4-7)", "complaint": "上腹痛，噁心，疼痛 6 分"},
        {"rule_code": "A040412", "symptom": "頭痛", "judge": "急性中樞中度疼痛(4-7)", "complaint": "頭痛兩天，伴隨噁心，無肢體無力"},
        {"rule_code": "A071404", "symptom": "上呼吸道感染", "judge": "發燒(看起來有病容)", "complaint": "發燒咳嗽，精神稍差，仍可對答"},
    ],
    4: [
        {"rule_code": "A071406", "symptom": "上呼吸道感染", "judge": "發燒(看起來無病容)", "complaint": "咳嗽流鼻水三天，低燒，活動力佳"},
        {"rule_code": "T110114", "symptom": "外傷", "judge": "急性中樞輕度疼痛(＜4)", "complaint": "跌倒後右膝擦傷，可行走，疼痛 3 分"},
        {"rule_code": "P030120", "symptom": "腹痛", "judge": "輕度疼痛(<4)", "complaint": "間歇性腹痛，可進食，疼痛 3 分"},
        {"rule_code": "A130214", "symptom": "發燒/畏寒", "judge": "發燒(看起來無病容)", "complaint": "低燒 37.8 度，精神良好"},
    ],
    5: [
        {"rule_code": "A071409", "symptom": "上呼吸道感染", "judge": "無危險徵象", "complaint": "喉嚨痛、流鼻水，無發燒"},
        {"rule_code": "T110115", "symptom": "外傷", "judge": "軟組織挫傷/血腫", "complaint": "打球扭傷腳踝，可行走，腫脹"},
        {"rule_code": "T100118", "symptom": "腰、背部鈍傷", "judge": "軟組織挫傷/血腫", "complaint": "搬重物後腰部酸痛，無放射痛"},
        {"rule_code": "A010311", "symptom": "咳嗽", "judge": "慢性咳嗽", "complaint": "乾咳一週，無發燒，精神良好"},
    ],
}

LEVEL_WEIGHTS = [1] * 5 + [2] * 15 + [3] * 30 + [4] * 30 + [5] * 20  # 共 100 筆分布
SEED_MARKER = "PRESENTATION_SEED"  # 寫入 encounter_extra.major_incident，供 --clear 辨識


def fake_id_number(gender: str) -> str:
    """產生外觀合理的示範用身分證字號（非真實）。"""
    letters_m = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z"]
    letters_f = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z"]
    letter = random.choice(letters_m if gender == "M" else letters_f)
    digits = random.randint(100000000, 299999999)
    return f"{letter}{digits:09d}"[:10]


def random_birth_date(age_group: str) -> date:
    """依年齡區間產生生日。"""
    ranges = {
        "0-18": (1, 18),
        "19-30": (19, 30),
        "31-45": (31, 45),
        "46-60": (46, 60),
        "61+": (61, 88),
    }
    lo, hi = ranges[age_group]
    age = random.randint(lo, hi)
    # 隨機月日，避免全部同天生日
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return date(TODAY.year - age, month, day)


def random_visit_time() -> datetime:
    """分布：今日 25%、本週 30%、本月其餘。到院時間上限為執行當下，不產生未來資料。"""
    now = datetime.now()
    today = now.date()
    roll = random.random()
    if roll < 0.25:
        target_date = today
    elif roll < 0.55:
        days_ago = random.randint(1, min(today.weekday() + 1, 6) or 1)
        target_date = today - timedelta(days=days_ago)
    else:
        days_ago = random.randint(7, 45)
        target_date = today - timedelta(days=days_ago)

    if target_date == today:
        day_start = datetime.combine(today, datetime.min.time())
        elapsed_seconds = max(0, int((now - day_start).total_seconds()))
        if elapsed_seconds == 0:
            return now.replace(second=0, microsecond=0)
        offset = random.randint(0, elapsed_seconds)
        visit = day_start + timedelta(seconds=offset)
        visit = visit.replace(minute=(visit.minute // 5) * 5, second=0, microsecond=0)
        return min(visit, now.replace(second=0, microsecond=0))

    peak_hours = list(range(8, 15)) + list(range(17, 23))
    hour = random.choice(peak_hours if random.random() < 0.7 else list(range(0, 24)))
    minute = random.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    return datetime(target_date.year, target_date.month, target_date.day, hour, minute, 0)


def vitals_for_level(level: int, age: int, gender: str) -> Dict[str, Any]:
    """依檢傷級數產生合理生命徵象。"""
    base_weight = 70 if gender == "M" else 58
    if age < 18:
        base_weight = max(15, int(base_weight * (age / 18)))
    elif age > 60:
        base_weight += random.randint(-5, 8)

    profiles = {
        1: dict(temp=(35.0, 36.5), hr=(40, 60), rr=(8, 12), spo2=(82, 89), sbp=(70, 90), dbp=(40, 55), pain=(8, 10), gcs=(3, 8)),
        2: dict(temp=(37.5, 39.5), hr=(110, 140), rr=(24, 32), spo2=(88, 92), sbp=(85, 100), dbp=(50, 65), pain=(7, 10), gcs=(9, 14)),
        3: dict(temp=(37.0, 38.8), hr=(90, 110), rr=(18, 24), spo2=(93, 96), sbp=(100, 130), dbp=(60, 80), pain=(4, 7), gcs=(14, 15)),
        4: dict(temp=(36.5, 37.8), hr=(75, 95), rr=(16, 20), spo2=(96, 98), sbp=(110, 140), dbp=(65, 85), pain=(1, 4), gcs=(15, 15)),
        5: dict(temp=(36.2, 37.2), hr=(65, 85), rr=(14, 18), spo2=(97, 99), sbp=(110, 130), dbp=(65, 82), pain=(0, 3), gcs=(15, 15)),
    }
    p = profiles[level]

    def pick(key: str) -> float:
        lo, hi = p[key]
        return round(random.uniform(lo, hi), 1) if key == "temp" else random.randint(int(lo), int(hi))

    gcs_total = pick("gcs")
    if gcs_total >= 15:
        gcs_e, gcs_v, gcs_m = 4, 5, 6
    elif gcs_total <= 8:
        gcs_e, gcs_v, gcs_m = random.randint(1, 2), random.randint(1, 3), random.randint(2, 4)
    else:
        gcs_e, gcs_v, gcs_m = random.randint(2, 4), random.randint(3, 4), random.randint(4, 6)

    return {
        "temperature": pick("temp"),
        "heart_rate": pick("hr"),
        "respiratory_rate": pick("rr"),
        "spo2": pick("spo2"),
        "blood_pressure_sys": pick("sbp"),
        "blood_pressure_dia": pick("dbp"),
        "blood_sugar": random.randint(80, 180) if random.random() < 0.4 else None,
        "weight": round(base_weight + random.uniform(-3, 3), 1),
        "gcs_eye": gcs_e,
        "gcs_verbal": gcs_v,
        "gcs_motor": gcs_m,
        "pain_score": pick("pain"),
        "past_medical_history": random.choice(PAST_HISTORY),
        "do_not_treat": 0,
        "allergy": random.choice(ALLERGIES),
        "sentiment": random.choice(["平穩", "焦慮", "不安", "躁動", None]),
    }


def make_patient(age_group: str, used_pids: set) -> Tuple[str, Dict[str, Any]]:
    birth = random_birth_date(age_group)
    age = TODAY.year - birth.year - ((TODAY.month, TODAY.day) < (birth.month, birth.day))
    gender = random.choice(["M", "F"])
    if age <= 12:
        given = random.choice(GIVEN_CHILD)
    elif gender == "M":
        given = random.choice(GIVEN_M)
    else:
        given = random.choice(GIVEN_F)
    name = random.choice(SURNAMES) + given
    while True:
        patient_id = "P" + "".join(str(random.randint(0, 9)) for _ in range(7))
        if patient_id not in used_pids:
            used_pids.add(patient_id)
            break
    return patient_id, {
        "patient_id": patient_id,
        "name": name,
        "id_number": fake_id_number(gender),
        "birth_date": birth,
        "gender": gender,
        "drug_allergy": random.choice(ALLERGIES),
        "age": age,
    }


def make_triage_id(patient_id: str, visit: datetime, used_ids: set) -> str:
    """與 triagesave.generate_medical_number 相同格式。"""
    date_part = visit.strftime("%Y%m%d")
    clean_id = str(patient_id).replace("P", "")
    pid_part = clean_id.zfill(6)[-6:]
    for _ in range(30):
        rand_part = secrets.token_hex(2).upper()
        triage_id = f"MRN-{date_part}-{pid_part}-{rand_part}"
        if triage_id not in used_ids:
            used_ids.add(triage_id)
            return triage_id
    raise RuntimeError("無法產生唯一檢傷號")


def clear_seed_data(cur) -> int:
    """清除本腳本產生的資料（含舊版 DEMO- 格式）。"""
    cur.execute(
        """
        SELECT DISTINCT t.triage_id
        FROM triage_record t
        LEFT JOIN encounter_extra e ON e.triage_id = t.triage_id
        LEFT JOIN patients p ON p.patient_id = t.patient_id
        WHERE t.triage_id LIKE 'DEMO-%%'
           OR e.major_incident = %s
           OR p.patient_id LIKE 'P9%%'
        """,
        (SEED_MARKER,),
    )
    ids = [r["triage_id"] for r in cur.fetchall()]
    if not ids:
        return 0
    placeholders = ",".join(["%s"] * len(ids))
    cur.execute(f"DELETE FROM triage_result WHERE triage_id IN ({placeholders})", ids)
    cur.execute(f"DELETE FROM vital_signs WHERE triage_id IN ({placeholders})", ids)
    cur.execute(f"DELETE FROM encounter_extra WHERE triage_id IN ({placeholders})", ids)
    cur.execute(f"DELETE FROM modification_logs WHERE target_record_id IN ({placeholders})", ids)
    cur.execute(f"DELETE FROM triage_record WHERE triage_id IN ({placeholders})", ids)
    cur.execute(
        """
        DELETE FROM patients
        WHERE patient_id LIKE 'P9%%'
           OR patient_id NOT IN (SELECT DISTINCT patient_id FROM triage_record WHERE patient_id IS NOT NULL)
        """
    )
    return len(ids)


def seed(count: int, clear: bool) -> None:
    age_groups = ["0-18", "19-30", "31-45", "46-60", "61+"]
    levels = (LEVEL_WEIGHTS * ((count // len(LEVEL_WEIGHTS)) + 1))[:count]
    random.shuffle(levels)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")
            removed = clear_seed_data(cur) if clear else 0

            nurse_ids = [1, 2, 3]
            inserted = 0
            used_pids: set = set()
            used_triage_ids: set = set()

            for i in range(count):
                age_group = age_groups[i % len(age_groups)]
                level = levels[i]
                patient_id, patient = make_patient(age_group, used_pids)
                visit = random_visit_time()
                triage_id = make_triage_id(patient_id, visit, used_triage_ids)
                case = random.choice(CASE_TEMPLATES[level])
                vitals = vitals_for_level(level, patient["age"], patient["gender"])
                nurse_id = random.choice(nurse_ids)
                bed = f"T{random.randint(1, 12):02d}"
                supplement = f"到院方式：{random.choice(PATIENT_SOURCES) or '自行'}。{case['complaint']}。"

                cur.execute(
                    """
                    INSERT INTO patients (patient_id, name, id_number, birth_date, gender, drug_allergy)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                      name=VALUES(name), birth_date=VALUES(birth_date),
                      gender=VALUES(gender), drug_allergy=VALUES(drug_allergy)
                    """,
                    (
                        patient["patient_id"],
                        patient["name"],
                        patient["id_number"],
                        patient["birth_date"],
                        patient["gender"],
                        patient["drug_allergy"],
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO triage_record (triage_id, patient_id, nurse_id, final_level, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (triage_id, patient_id, nurse_id, level, visit),
                )

                cur.execute(
                    """
                    INSERT INTO vital_signs (
                        triage_id, temperature, heart_rate, spo2, respiratory_rate, weight,
                        blood_pressure_sys, blood_pressure_dia, blood_sugar, gcs_eye, gcs_verbal,
                        gcs_motor, past_medical_history, do_not_treat, allergy, pain_score, sentiment
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        triage_id,
                        vitals["temperature"],
                        vitals["heart_rate"],
                        vitals["spo2"],
                        vitals["respiratory_rate"],
                        vitals["weight"],
                        vitals["blood_pressure_sys"],
                        vitals["blood_pressure_dia"],
                        vitals["blood_sugar"],
                        vitals["gcs_eye"],
                        vitals["gcs_verbal"],
                        vitals["gcs_motor"],
                        vitals["past_medical_history"],
                        vitals["do_not_treat"],
                        vitals["allergy"],
                        vitals["pain_score"],
                        vitals["sentiment"],
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO triage_result (triage_id, rule_code, chief_complaint, original_transcript)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (triage_id, case["rule_code"], case["complaint"], supplement),
                )

                tocc_symptoms = case["symptom"]
                cur.execute(
                    """
                    INSERT INTO encounter_extra (
                        triage_id, bed, patient_source, major_incident, visit_time,
                        tocc_travel, tocc_cluster_items, tocc_symptoms, tocc_occupation
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        triage_id,
                        bed,
                        random.choice(PATIENT_SOURCES),
                        SEED_MARKER,
                        visit,
                        "",
                        "",
                        tocc_symptoms,
                        random.choice(["一般", "學生", "服務業", ""]),
                    ),
                )
                inserted += 1

            conn.commit()
            print(f"已清除舊展示資料：{removed} 筆")
            print(f"已新增檢傷紀錄：{inserted} 筆")
            print("檢傷號格式：MRN-YYYYMMDD-xxxxxx-XXXX（與正式資料相同）")
            print(f"今日（{TODAY}）資料已依執行當天日期分布，統計頁可直接使用。")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="產生檢傷展示用假資料")
    parser.add_argument("--count", type=int, default=100, help="產生筆數（預設 100）")
    parser.add_argument(
        "--no-clear",
        action="store_true",
        help="保留上次由本腳本產生的資料並追加（預設會先自動清除再重建）",
    )
    args = parser.parse_args()
    if args.count < 1 or args.count > 500:
        raise SystemExit("count 請介於 1～500")
    seed(args.count, clear=not args.no_clear)


if __name__ == "__main__":
    main()
