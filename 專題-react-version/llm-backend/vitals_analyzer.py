# 生命徵象分析器 - 檢測異常值並生成症狀描述

from typing import Dict, List, Optional, Tuple

# 分析器產出的標籤 → 候選症狀庫可能出現的名稱（供 recommend-symptoms / RAG 共用）
VITAL_LABEL_TO_CANDIDATE_SYMPTOMS: Dict[str, List[str]] = {
    "發燒": ["發燒", "體溫過高", "發熱"],
    "高燒": ["高燒", "體溫過高", "發熱", "發燒"],
    "輕度高血壓": ["輕度高血壓", "高血壓", "血壓過高"],
    "重度高血壓": ["重度高血壓", "高血壓", "血壓過高", "嚴重高血壓"],
    "嚴重高血壓": ["嚴重高血壓", "高血壓", "血壓過高", "重度高血壓"],
    "舒張期高血壓": ["舒張期高血壓", "高血壓", "血壓過高"],
    "低血壓": ["低血壓", "血壓過低"],
    "心跳過速": ["心跳過速", "心悸", "心跳快"],
    "心跳過緩": ["心跳過緩", "心跳慢"],
    "輕微低血氧": ["輕微低血氧", "低血氧", "血氧過低"],
    "嚴重低血氧": ["嚴重低血氧", "低血氧", "血氧過低", "缺氧"],
    "呼吸急促": ["呼吸急促", "呼吸困難", "呼吸快"],
    "呼吸過緩": ["呼吸過緩", "呼吸慢"],
    "高血糖": ["高血糖", "血糖過高"],
    "低血糖": ["低血糖", "血糖過低", "血糖偏低"],
}


def match_vital_labels_to_symptom_candidates(
    vital_labels: List[str], symptom_candidates: List[str]
) -> List[str]:
    """依生命徵象標籤，在候選症狀清單中各取第一個對得上之名稱（順序與 vital_labels 一致）。

    流程（Phase 1）：
    1. 先用 `VITAL_LABEL_TO_CANDIDATE_SYMPTOMS` 硬寫字典做快路徑，相容既有對應。
    2. 字典未命中或字典回的別名都不在候選裡時，退回 RAG 語意檢索。
       例：GCS=8 → vitals_analyzer 輸出「嚴重意識障礙」，字典裡沒對應，
       但語意檢索能在候選清單中找到 TTAS 標準名「意識程度改變」。
    這層保留是為了「之後 Phase 1 完全穩定後可以一口氣把字典刪掉」做緩衝。
    """
    matched: List[str] = []
    candidate_set = set(symptom_candidates or [])
    seen = set()

    def _add(name: str) -> bool:
        if not name or name in seen or name not in candidate_set:
            return False
        matched.append(name)
        seen.add(name)
        return True

    # 延遲匯入避免 module circular import（rag_pipeline 也會 import vitals_analyzer）
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
        # 1. 字典快路徑
        options = VITAL_LABEL_TO_CANDIDATE_SYMPTOMS.get(vital_label, [vital_label])
        if any(_add(name) for name in options):
            continue
        # 2. fallback：直接用 label 做語意檢索
        semantic_hit = _semantic_lookup(vital_label)
        if semantic_hit:
            _add(semantic_hit)

    return matched


class VitalsAnalyzer:
    def __init__(self):
        # 成人生命徵象正常範圍設定
        self.normal_ranges = {
            'temperature': {'min': 35.0, 'max': 38.0, 'unit': '°C'},
            'heart_rate': {'min': 60, 'max': 100, 'unit': '次/分'},
            'spo2': {'min': 94, 'max': 100, 'unit': '%'},
            'resp_rate': {'min': 12, 'max': 20, 'unit': '次/分'},
            'systolic_bp': {'min': 90, 'max': 140, 'unit': 'mmHg'},
            'diastolic_bp': {'min': 60, 'max': 90, 'unit': 'mmHg'},
            'blood_sugar': {'min': 70, 'max': 140, 'unit': 'mg/dL'},
        }
    
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
    
    def analyze_temperature(self, temp: Optional[float]) -> List[str]:
        """分析體溫異常"""
        if temp is None:
            return []
        
        symptoms = []
        # 數值層僅輸出「發燒」（≥38°C），不再另立「超高熱」標籤；與 TTAS 口述／條文習慣一致。
        if temp >= 38.0:
            symptoms.append("發燒")
        elif temp < 35.0:
            symptoms.append("體溫過低")
        
        return symptoms
    
    def analyze_blood_pressure(self, systolic: Optional[float], diastolic: Optional[float]) -> List[str]:
        """分析血壓異常"""
        symptoms = []
        
        if systolic is not None:
            if systolic >= 180:
                symptoms.append("嚴重高血壓")
            elif systolic >= 160:
                symptoms.append("重度高血壓")
            elif systolic >= 140:
                symptoms.append("輕度高血壓")
            elif systolic < 90:
                symptoms.append("低血壓")
        
        if diastolic is not None:
            if diastolic >= 110:
                symptoms.append("重度舒張期高血壓")
            elif diastolic >= 90:
                symptoms.append("舒張期高血壓")
            elif diastolic < 60:
                symptoms.append("舒張期低血壓")
        
        return symptoms
    
    def analyze_heart_rate(self, hr: Optional[float]) -> List[str]:
        """分析心跳異常"""
        if hr is None:
            return []
        
        symptoms = []
        if hr >= 120:
            symptoms.append("心跳過速")
        elif hr < 60:
            symptoms.append("心跳過緩")
        
        return symptoms
    
    def analyze_spo2(self, spo2: Optional[float]) -> List[str]:
        """分析血氧飽和度異常"""
        if spo2 is None:
            return []
        
        symptoms = []
        if spo2 < 90:
            symptoms.append("嚴重低血氧")
        elif spo2 < 94:
            symptoms.append("輕微低血氧")
        
        return symptoms
    
    def analyze_respiratory_rate(self, rr: Optional[float]) -> List[str]:
        """分析呼吸頻率異常"""
        if rr is None:
            return []
        
        symptoms = []
        if rr >= 24:
            symptoms.append("呼吸急促")
        elif rr < 12:
            symptoms.append("呼吸過緩")
        
        return symptoms
    
    def analyze_blood_sugar(self, bs: Optional[float], bs_level: Optional[str] = None) -> List[str]:
        """分析血糖異常"""
        if bs is None:
            return []
        
        symptoms = []
        
        # 如果有明確的標記，優先使用
        if bs_level:
            if bs_level.lower() == 'high':
                symptoms.append("高血糖")
            elif bs_level.lower() == 'low':
                symptoms.append("低血糖")
        else:
            # 根據數值判斷
            if bs >= 200:
                symptoms.append("嚴重高血糖")
            elif bs >= 140:
                symptoms.append("高血糖")
            elif bs < 54:
                symptoms.append("嚴重低血糖")
            elif bs < 70:
                symptoms.append("低血糖")
        
        return symptoms
    
    def analyze_gcs(self, eye: Optional[str], verbal: Optional[str], motor: Optional[str]) -> List[str]:
        """分析GCS異常"""
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
    
    def analyze_pain_score(self, pain: Optional[int]) -> List[str]:
        """分析疼痛指數"""
        if pain is None:
            return []
        
        symptoms = []
        if pain >= 8:
            symptoms.append("嚴重疼痛")
        elif pain >= 5:
            symptoms.append("中度疼痛")
        elif pain >= 2:
            symptoms.append("輕微疼痛")
        
        return symptoms
    
    def analyze_vitals(self, vitals: Dict[str, any]) -> Tuple[List[str], Dict[str, any]]:
        """
        分析所有生命徵象，回傳症狀列表和異常摘要
        
        Args:
            vitals: 生命徵象字典
            
        Returns:
            Tuple[List[str], Dict[str, any]]: (症狀列表, 異常摘要)
        """
        symptoms = []
        abnormal_summary = {}
        
        # 每個欄位都拆開判斷，最後再合併，方便後續調單一規則
        # 體溫
        temp = self.parse_vital_value(vitals.get('temperature'))
        temp_symptoms = self.analyze_temperature(temp)
        symptoms.extend(temp_symptoms)
        if temp_symptoms:
            abnormal_summary['temperature'] = {
                'value': temp,
                'symptoms': temp_symptoms
            }
        
        # 血壓
        systolic = self.parse_vital_value(vitals.get('systolicBP') or vitals.get('blood_pressure_sys'))
        diastolic = self.parse_vital_value(vitals.get('diastolicBP') or vitals.get('blood_pressure_dia'))
        bp_symptoms = self.analyze_blood_pressure(systolic, diastolic)
        symptoms.extend(bp_symptoms)
        if bp_symptoms:
            abnormal_summary['blood_pressure'] = {
                'systolic': systolic,
                'diastolic': diastolic,
                'symptoms': bp_symptoms
            }
        
        # 心跳
        hr = self.parse_vital_value(vitals.get('heartRate') or vitals.get('heart_rate'))
        hr_symptoms = self.analyze_heart_rate(hr)
        symptoms.extend(hr_symptoms)
        if hr_symptoms:
            abnormal_summary['heart_rate'] = {
                'value': hr,
                'symptoms': hr_symptoms
            }
        
        # 血氧
        spo2 = self.parse_vital_value(vitals.get('spo2'))
        spo2_symptoms = self.analyze_spo2(spo2)
        symptoms.extend(spo2_symptoms)
        if spo2_symptoms:
            abnormal_summary['spo2'] = {
                'value': spo2,
                'symptoms': spo2_symptoms
            }
        
        # 呼吸頻率
        rr = self.parse_vital_value(vitals.get('respRate') or vitals.get('respiratory_rate'))
        rr_symptoms = self.analyze_respiratory_rate(rr)
        symptoms.extend(rr_symptoms)
        if rr_symptoms:
            abnormal_summary['respiratory_rate'] = {
                'value': rr,
                'symptoms': rr_symptoms
            }
        
        # 血糖
        bs = self.parse_vital_value(vitals.get('bloodSugar') or vitals.get('blood_sugar'))
        bs_level = vitals.get('bloodSugarLevel') or vitals.get('blood_sugar_level')
        bs_symptoms = self.analyze_blood_sugar(bs, bs_level)
        symptoms.extend(bs_symptoms)
        if bs_symptoms:
            abnormal_summary['blood_sugar'] = {
                'value': bs,
                'level': bs_level,
                'symptoms': bs_symptoms
            }
        
        # GCS
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
                'symptoms': gcs_symptoms
            }
        
        # 疼痛指數
        pain = vitals.get('painScore') or vitals.get('pain_score')
        if isinstance(pain, str):
            try:
                pain = int(pain)
            except (ValueError, TypeError):
                pain = None
        pain_symptoms = self.analyze_pain_score(pain)
        symptoms.extend(pain_symptoms)
        if pain_symptoms:
            abnormal_summary['pain_score'] = {
                'value': pain,
                'symptoms': pain_symptoms
            }
        
        # 同一病人可能命中多條規則，這裡做去重避免後續 prompt 太亂
        unique_symptoms = []
        seen = set()
        for symptom in symptoms:
            if symptom not in seen:
                unique_symptoms.append(symptom)
                seen.add(symptom)
        
        return unique_symptoms, abnormal_summary


# 初始化分析器
vitals_analyzer = VitalsAnalyzer()


def filter_recommended_symptoms_by_vitals(
    recommended: List[str],
    vitals: Optional[Dict],
    vitals_symptoms: List[str],
) -> List[str]:
    """
    移除與已輸入生命徵象／規則層標籤明顯矛盾的 TTAS 症狀名。
    例：語意檢索可能把「舒張期低血壓」誤拉近「低體溫症」（皆有「低」），但體溫已發燒時不應推薦低體溫症。
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
