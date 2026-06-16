-- patients 表新增過去病史（與 vital_signs.past_medical_history 格式相同）
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS past_medical_history TEXT NULL AFTER drug_allergy;
