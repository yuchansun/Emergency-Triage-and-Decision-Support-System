import os
import re
import pandas as pd
from fastapi import APIRouter

router = APIRouter()

# --- 同步前端需求的部位對應（加入 T 外傷）---
BODY_PART_MAPPING = {
    "head": [
        'P04', 'P08', 'P07', 'P01',
        'T02','T03','T04','T05','T06','T07'  # 頭部外傷
    ],
    "upper": [
        'P02', 'P03', 'P11', 'P12',
        'T08'  # 胸部外傷
    ],
}

DATA_DIR = r"C:\xampp\htdocs\專題test\專題-react-version\llm-backend\data"

def clean_code(c):
    if pd.isna(c): return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(c)).upper()

def clean_chinese_name(name):
    if not name: return ""
    return re.sub(r'^[A-Z0-9]+', '', str(name)).strip()

def safe_read_csv(file_path):
    for enc in ['cp950', 'utf-8-sig', 'utf-8']:
        try:
            return pd.read_csv(file_path, encoding=enc, on_bad_lines='skip', engine='python')
        except:
            continue
    return None


@router.get("/api/symptoms-by-frequency/{part}")
async def get_symptoms_by_frequency(part: str):
    try:
        # ===== 1️⃣ 讀 P + T 檔案 =====
        df_sys_P = safe_read_csv(os.path.join(DATA_DIR, "605662271104352359_dist_system_P.csv"))
        df_comp_P = safe_read_csv(os.path.join(DATA_DIR, "605662269409854005_dist_complaint_P.csv"))

        # 👉 ⚠️ 這裡改成你的 T 檔名
        df_sys_T = safe_read_csv(os.path.join(DATA_DIR, "605662268570730778_dist_system_T.csv"))
        df_comp_T = safe_read_csv(os.path.join(DATA_DIR, "605662269829284217_dist_complaint_T.csv"))

        df_protocol = safe_read_csv(os.path.join(DATA_DIR, "protocol_ttas.csv"))

        if df_sys_P is None or df_comp_P is None or df_protocol is None:
            return {"status": "error", "message": "CSV files not found or encoding error"}

        # 👉 如果 T 沒有也不會炸
        if df_sys_T is not None and df_comp_T is not None:
            df_sys = pd.concat([df_sys_P, df_sys_T], ignore_index=True)
            df_comp = pd.concat([df_comp_P, df_comp_T], ignore_index=True)
        else:
            df_sys = df_sys_P
            df_comp = df_comp_P

        # ===== 2️⃣ 建立名稱對照 =====
        df_protocol.columns = df_protocol.columns.str.strip()
        name_map = {}

        df_protocol = df_protocol.sort_values('OTHER')

        for _, row in df_protocol.iterrows():
            full_key = clean_code(row.get('OTHER', ''))
            if not full_key: continue

            t_name = clean_chinese_name(row.get('T_NAMEC', ''))
            cc_name = clean_chinese_name(row.get('CC_NAMEC', ''))

            val = {"T": t_name, "CC": cc_name}
            name_map[full_key] = val

            short_3 = full_key[:3]
            short_5 = full_key[:5]

            if short_3 not in name_map: name_map[short_3] = val
            if short_5 not in name_map: name_map[short_5] = val

        # ===== 3️⃣ 部位過濾 =====
        part_key = part.lower()

        df_sys['system'] = df_sys['system'].astype(str).str.strip().str.upper()

        all_defined_systems = BODY_PART_MAPPING["head"] + BODY_PART_MAPPING["upper"]

        if part_key == "head":
            target_systems = BODY_PART_MAPPING["head"]
        elif part_key == "upper":
            target_systems = BODY_PART_MAPPING["upper"]
        elif part_key == "lower":
            target_systems = [
                s for s in df_sys['system'].unique()
                if s not in all_defined_systems
            ]
        else:
            target_systems = []

        sys_sorted = df_sys[
            df_sys['system'].isin(target_systems)
        ].sort_values('count', ascending=False)

        final_result = []

        df_comp['chief_complaint'] = df_comp['chief_complaint'].astype(str).str.strip().str.upper()

        # ===== 4️⃣ 組裝資料 =====
        for _, s_row in sys_sorted.iterrows():
            sys_id = s_row['system']

            # 🔥 改這裡（更穩，支援 T）
            comp_filtered = df_comp[
                df_comp['chief_complaint'].str[:3] == sys_id
            ]

            comp_sorted = comp_filtered.sort_values('count', ascending=False).head(10)

            symptoms_list = []

            for _, c_row in comp_sorted.iterrows():
                raw_code = c_row['chief_complaint']
                search_key = clean_code(raw_code)

                info = name_map.get(search_key) or name_map.get(search_key[:5], {})
                display_name = info.get("CC", raw_code)

                symptoms_list.append({
                    "code": raw_code,
                    "name": display_name,
                    "count": int(c_row['count'])
                })

            sys_info = name_map.get(clean_code(sys_id))
            sys_name = sys_info.get("T") if sys_info else sys_id

            if (not sys_name or sys_name == sys_id) and symptoms_list:
                first_sym_info = name_map.get(clean_code(symptoms_list[0]['code']))
                if first_sym_info:
                    sys_name = first_sym_info.get("T")

            if symptoms_list:
                final_result.append({
                    "system_id": sys_id,
                    "system_name": sys_name,
                    "system_count": int(s_row['count']),
                    "symptoms": symptoms_list
                })

        return {"status": "success", "data": final_result}

    except Exception as e:
        return {"status": "error", "message": str(e)}