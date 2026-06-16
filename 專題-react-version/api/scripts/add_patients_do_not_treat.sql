-- patients 表新增禁治療詳情（與 vital_signs.do_not_treat 相同）
ALTER TABLE patients
  ADD COLUMN do_not_treat VARCHAR(255) NULL AFTER past_medical_history;
