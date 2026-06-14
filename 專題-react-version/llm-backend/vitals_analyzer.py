# 生命徵象分析器 - 僅輸出有臨床依據的客觀異常標籤；其餘交由 LLM+RAG 解讀

from typing import Dict, List, Optional, Tuple

# 各門檻簡述依據（急診／TTAS 常用參考，非完整臨床指引）：
# - 發燒 ≥38°C：常規發熱定義
# - 低血氧 SpO2 <90%：明顯低氧血症
# - 低血壓 SBP <90 mmHg：休克／灌注不足警戒
# - 高血壓危象 SBP≥180 且 DBP≥120：AHA 高血壓急症定義
# - 低血糖 <70 mg/dL、嚴重 <54 mg/dL：ADA 低血糖分級
# - GCS ≤8/≤12/≤14：神經學意識障礙分級（Glasgow Coma Scale）


def match_vital_labels_to_symptom_candidates(
    vital_labels: List[str], symptom_candidates: List[str]
) -> List[str]:
    """依生命徵象標籤，以 RAG 語意檢索在候選症狀清單中找對應名稱。"""
    matched: List[str] = []
    candidate_set = set(symptom_candidates or [])
    seen = set()

    def _add(name: str) -> bool:
        if not name or name in seen or name not in candidate_set:
            return False
        matched.append(name)
        seen.add(name)
        return True

    _rag = None

    def _semantic_lookup(query: str) -> str:
        nonlocal _rag
        if not candidate_set:
            return ""
        if _rag is None:
            try:
                from rag_pipeline import rag_pipeline as _imported  # noqa: WPS433
                _rag = _imported
            except Exception as e:
                print(f"❌ vitals_analyzer 無法載入 rag_pipeline 做語意檢索：{e}")
                _rag = False
        if not _rag:
            return ""
        try:
            top = _rag.find_similar_symptoms(query, list(candidate_set), top_k=1)
            return top[0] if top else ""
        except Exception as e:
            print(f"❌ vitals_analyzer 語意檢索錯誤：{e}")
            return ""

    for vital_label in vital_labels or []:
        if not vital_label:
            continue
        if _add(vital_label):
            continue
        semantic_hit = _semantic_lookup(vital_label)
        if semantic_hit:
            _add(semantic_hit)

    return matched


class VitalsAnalyzer:
    def parse_vital_value(self, value) -> Optional[float]:
        """將字串轉換為數值，處理空值和無效輸入"""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str) and value.strip() != '':
            try:
                return float(value.strip())
            except (ValueError, TypeError):
                return None
        return None

    def format_vitals_for_llm(self, vitals: Dict[str, any]) -> str:
        """將生命徵象格式化成客觀數值描述，供 LLM+RAG 參考（不含臆測性症狀標籤）。"""
        if not vitals:
            return ""

        parts: List[str] = []

        temp = self.parse_vital_value(vitals.get('temperature'))
        if temp is not None:
            parts.append(f"體溫 {temp}°C")

        systolic = self.parse_vital_value(vitals.get('systolicBP') or vitals.get('blood_pressure_sys'))
        diastolic = self.parse_vital_value(vitals.get('diastolicBP') or vitals.get('blood_pressure_dia'))
        if systolic is not None or diastolic is not None:
            sys_str = str(int(systolic)) if systolic is not None else "—"
            dia_str = str(int(diastolic)) if diastolic is not None else "—"
            parts.append(f"血壓 {sys_str}/{dia_str} mmHg")

        hr = self.parse_vital_value(vitals.get('heartRate') or vitals.get('heart_rate'))
        if hr is not None:
            parts.append(f"心跳 {int(hr)} 次/分")

        spo2 = self.parse_vital_value(vitals.get('spo2'))
        if spo2 is not None:
            parts.append(f"血氧 SpO2 {int(spo2)}%")

        rr = self.parse_vital_value(vitals.get('respRate') or vitals.get('respiratory_rate'))
        if rr is not None:
            parts.append(f"呼吸 {int(rr)} 次/分")

        bs = self.parse_vital_value(vitals.get('bloodSugar') or vitals.get('blood_sugar'))
        if bs is not None:
            parts.append(f"血糖 {int(bs)} mg/dL")

        gcs_eye = vitals.get('gcsEye') or vitals.get('gcs_eye')
        gcs_verbal = vitals.get('gcsVerbal') or vitals.get('gcs_verbal')
        gcs_motor = vitals.get('gcsMotor') or vitals.get('gcs_motor')
        if any(x is not None and str(x).strip() for x in (gcs_eye, gcs_verbal, gcs_motor)):
            parts.append(f"GCS E{gcs_eye or '—'}V{gcs_verbal or '—'}M{gcs_motor or '—'}")

        pain = vitals.get('painScore') or vitals.get('pain_score')
        if pain is not None and str(pain).strip():
            parts.append(f"疼痛指數 {pain}/10")

        return "、".join(parts)

    def analyze_temperature(self, temp: Optional[float]) -> List[str]:
        if temp is None:
            return []
        symptoms = []
        if temp >= 38.0:
            symptoms.append("發燒")
        elif temp < 35.0:
            symptoms.append("體溫過低")
        return symptoms

    def analyze_blood_pressure(self, systolic: Optional[float], diastolic: Optional[float]) -> List[str]:
        """僅保留有明確急診意義的血壓異常（低血壓、高血壓危象）。"""
        symptoms = []
        if systolic is not None and systolic < 90:
            symptoms.append("低血壓")
        if systolic is not None and diastolic is not None:
            if systolic >= 180 and diastolic >= 120:
                symptoms.append("高血壓危象")
        return symptoms

    def analyze_heart_rate(self, hr: Optional[float]) -> List[str]:
        if hr is None:
            return []
        symptoms = []
        if hr > 100:
            symptoms.append("心跳過速")
        elif hr < 60:
            symptoms.append("心跳過緩")
        return symptoms

    def analyze_spo2(self, spo2: Optional[float]) -> List[str]:
        if spo2 is None:
            return []
        symptoms = []
        if spo2 < 90:
            symptoms.append("低血氧")
        return symptoms

    def analyze_respiratory_rate(self, rr: Optional[float]) -> List[str]:
        if rr is None:
            return []
        symptoms = []
        if rr > 20:
            symptoms.append("呼吸急促")
        elif rr < 12:
            symptoms.append("呼吸過緩")
        return symptoms

    def analyze_blood_sugar(self, bs: Optional[float], bs_level: Optional[str] = None) -> List[str]:
        """僅保留低血糖（有明確數值指引）；高血糖僅在使用者明確標記時納入。"""
        if bs is None and not bs_level:
            return []

        symptoms = []
        if bs_level:
            level = bs_level.lower()
            if level == 'low':
                symptoms.append("低血糖")
            elif level == 'high':
                symptoms.append("高血糖")
        elif bs is not None:
            if bs < 54:
                symptoms.append("嚴重低血糖")
            elif bs < 70:
                symptoms.append("低血糖")
        return symptoms

    def analyze_gcs(self, eye: Optional[str], verbal: Optional[str], motor: Optional[str]) -> List[str]:
        if eye is None and verbal is None and motor is None:
            return []
        try:
            eye_score = int(eye) if eye else None
            verbal_score = int(verbal) if verbal else None
            motor_score = int(motor) if motor else None

            total_score = 0
            if eye_score is not None:
                total_score += eye_score
            if verbal_score is not None:
                total_score += verbal_score
            if motor_score is not None:
                total_score += motor_score

            symptoms = []
            if total_score <= 8:
                symptoms.append("嚴重意識障礙")
            elif total_score <= 12:
                symptoms.append("中度意識障礙")
            elif total_score <= 14:
                symptoms.append("輕微意識障礙")
            return symptoms
        except (ValueError, TypeError):
            return []

    def analyze_vitals(self, vitals: Dict[str, any]) -> Tuple[List[str], Dict[str, any]]:
        """
        分析生命徵象，回傳有依據的異常標籤與摘要。
        未達明確門檻的數值不會被強制轉成症狀，交由 LLM+RAG 搭配 format_vitals_for_llm 解讀。
        """
        symptoms = []
        abnormal_summary = {}

        temp = self.parse_vital_value(vitals.get('temperature'))
        temp_symptoms = self.analyze_temperature(temp)
        symptoms.extend(temp_symptoms)
        if temp_symptoms:
            abnormal_summary['temperature'] = {'value': temp, 'symptoms': temp_symptoms}

        systolic = self.parse_vital_value(vitals.get('systolicBP') or vitals.get('blood_pressure_sys'))
        diastolic = self.parse_vital_value(vitals.get('diastolicBP') or vitals.get('blood_pressure_dia'))
        bp_symptoms = self.analyze_blood_pressure(systolic, diastolic)
        symptoms.extend(bp_symptoms)
        if bp_symptoms:
            abnormal_summary['blood_pressure'] = {
                'systolic': systolic,
                'diastolic': diastolic,
                'symptoms': bp_symptoms,
            }

        hr = self.parse_vital_value(vitals.get('heartRate') or vitals.get('heart_rate'))
        hr_symptoms = self.analyze_heart_rate(hr)
        symptoms.extend(hr_symptoms)
        if hr_symptoms:
            abnormal_summary['heart_rate'] = {'value': hr, 'symptoms': hr_symptoms}

        spo2 = self.parse_vital_value(vitals.get('spo2'))
        spo2_symptoms = self.analyze_spo2(spo2)
        symptoms.extend(spo2_symptoms)
        if spo2_symptoms:
            abnormal_summary['spo2'] = {'value': spo2, 'symptoms': spo2_symptoms}

        rr = self.parse_vital_value(vitals.get('respRate') or vitals.get('respiratory_rate'))
        rr_symptoms = self.analyze_respiratory_rate(rr)
        symptoms.extend(rr_symptoms)
        if rr_symptoms:
            abnormal_summary['respiratory_rate'] = {'value': rr, 'symptoms': rr_symptoms}

        bs = self.parse_vital_value(vitals.get('bloodSugar') or vitals.get('blood_sugar'))
        bs_level = vitals.get('bloodSugarLevel') or vitals.get('blood_sugar_level')
        bs_symptoms = self.analyze_blood_sugar(bs, bs_level)
        symptoms.extend(bs_symptoms)
        if bs_symptoms:
            abnormal_summary['blood_sugar'] = {
                'value': bs,
                'level': bs_level,
                'symptoms': bs_symptoms,
            }

        gcs_eye = vitals.get('gcsEye') or vitals.get('gcs_eye')
        gcs_verbal = vitals.get('gcsVerbal') or vitals.get('gcs_verbal')
        gcs_motor = vitals.get('gcsMotor') or vitals.get('gcs_motor')
        gcs_symptoms = self.analyze_gcs(gcs_eye, gcs_verbal, gcs_motor)
        symptoms.extend(gcs_symptoms)
        if gcs_symptoms:
            abnormal_summary['gcs'] = {
                'eye': gcs_eye,
                'verbal': gcs_verbal,
                'motor': gcs_motor,
                'symptoms': gcs_symptoms,
            }

        unique_symptoms = []
        seen = set()
        for symptom in symptoms:
            if symptom not in seen:
                unique_symptoms.append(symptom)
                seen.add(symptom)

        return unique_symptoms, abnormal_summary


vitals_analyzer = VitalsAnalyzer()


def filter_recommended_symptoms_by_vitals(
    recommended: List[str],
    vitals: Optional[Dict],
    vitals_symptoms: List[str],
) -> List[str]:
    """
    移除與已輸入生命徵象明顯矛盾的 TTAS 症狀名。
    例：體溫已發燒時不應推薦低體溫症。
    """
    if not recommended:
        return recommended
    vitals = vitals or {}
    temp = vitals_analyzer.parse_vital_value(vitals.get("temperature"))

    fever_like = False
    if temp is not None and temp >= 38.0:
        fever_like = True
    if "發燒" in vitals_symptoms:
        fever_like = True

    hypothermia_like = False
    if temp is not None and temp < 35.0:
        hypothermia_like = True
    if any(x in vitals_symptoms for x in ("體溫過低",)):
        hypothermia_like = True

    out: List[str] = []
    for name in recommended:
        if fever_like and name in ("低體溫症", "體溫過低"):
            continue
        if hypothermia_like and name in ("發燒/畏寒",):
            continue
        out.append(name)
    return out
