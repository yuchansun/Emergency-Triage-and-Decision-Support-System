# 生命徵象分析器 - 檢測異常值並生成症狀描述

from typing import Dict, List, Optional, Tuple

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
    
    def parse_vital_value(self, value: str) -> Optional[float]:
        """將字串轉換為數值，處理空值和無效輸入"""
        if not value or value.strip() == '':
            return None
        try:
            return float(value.strip())
        except (ValueError, TypeError):
            return None
    
    def analyze_temperature(self, temp: Optional[float]) -> List[str]:
        """分析體溫異常"""
        if temp is None:
            return []
        
        symptoms = []
        if temp >= 40.0:
            symptoms.append("超高熱")
        elif temp >= 38.0:
            symptoms.append("發燒")  # 統一為"發燒"，不分"高燒"
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
        
        # 去除重複症狀並保持順序
        unique_symptoms = []
        seen = set()
        for symptom in symptoms:
            if symptom not in seen:
                unique_symptoms.append(symptom)
                seen.add(symptom)
        
        return unique_symptoms, abnormal_summary

# 初始化分析器
vitals_analyzer = VitalsAnalyzer()
