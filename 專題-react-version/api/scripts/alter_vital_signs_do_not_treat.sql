-- 禁治療詳情（DNR、DNI 等）為文字，非 0/1 旗標
ALTER TABLE vital_signs
  MODIFY COLUMN do_not_treat VARCHAR(255) NULL;
