export type MultilingualItem = {
  zh: string;
  en: string;
  ja: string;
  ko: string;
  vi: string;
  id: string;
};

export type FieldHelpContent = {
  title: string;
  questions: string[];
  commonLabel: string;
  commonItems: MultilingualItem[];
};

export const PAST_HISTORY_HELP: FieldHelpContent = {
  title: '過去病史 — 詢問用語',
  questions: [
    '你有沒有過去病史？',
    'Do you have any medical history?',
    '過去に何か病気にかかったことはありますか？',
    '과거에 앓았던 질환이나 병력이 있으신가요?',
    'Anh/Chị có tiền sử bệnh lý gì không?',
    'Apakah Anda memiliki riwayat penyakit sebelumnya?',
  ],
  commonLabel: '常見過去病史',
  commonItems: [
    { zh: '高血壓', en: 'Hypertension', ja: '高血圧', ko: '고혈압', vi: 'Tăng huyết áp', id: 'Hipertensi' },
    { zh: '糖尿病', en: 'Diabetes', ja: '糖尿病', ko: '당뇨병', vi: 'Đái tháo đường', id: 'Diabetes' },
    { zh: '心臟病', en: 'Heart disease', ja: '心臓病', ko: '심장병', vi: 'Bệnh tim', id: 'Penyakit jantung' },
    { zh: '肺部疾病', en: 'Lung disease', ja: '肺疾患', ko: '폐질환', vi: 'Bệnh phổi', id: 'Penyakit paru-paru' },
    { zh: '癌症', en: 'Cancer', ja: 'がん', ko: '암', vi: 'Ung thư', id: 'Kanker' },
    { zh: '高血脂', en: 'Hyperlipidemia', ja: '高脂血症', ko: '고지혈증', vi: 'Rối loạn lipid máu', id: 'Dislipidemia' },
    { zh: '洗腎', en: 'Dialysis', ja: '透析', ko: '투석', vi: 'Lọc máu', id: 'Dialisis' },
    { zh: '中風', en: 'Stroke', ja: '脳卒中', ko: '뇌졸중', vi: 'Đột quỵ', id: 'Stroke' },
    { zh: '腎臟病', en: 'Kidney disease', ja: '腎臓病', ko: '신장병', vi: 'Bệnh thận', id: 'Penyakit ginjal' },
    { zh: '甲狀腺疾病', en: 'Thyroid disease', ja: '甲状腺疾患', ko: '갑상선 질환', vi: 'Bệnh tuyến giáp', id: 'Penyakit tiroid' },
    { zh: '痛風', en: 'Gout', ja: '痛風', ko: '통풍', vi: 'Gout', id: 'Asam urat' },
  ],
};

export const DRUG_ALLERGY_HELP: FieldHelpContent = {
  title: '藥物過敏 — 詢問用語',
  questions: [
    '你有沒有藥物過敏？',
    'Do you have any drug allergies?',
    'お薬のアレルギーはありますか？',
    '약물 알레르기가 있으신가요?',
    'Anh/Chị có bị dị ứng thuốc gì không?',
    'Apakah Anda memiliki alergi obat?',
  ],
  commonLabel: '常見藥物過敏',
  commonItems: [
    { zh: '盤尼西林', en: 'Penicillin', ja: 'ペニシリン', ko: '페니실린', vi: 'Penicillin', id: 'Penisilin' },
    { zh: '阿斯匹靈', en: 'Aspirin', ja: 'アスピリン', ko: '아스피린', vi: 'Aspirin', id: 'Aspirin' },
    { zh: '磺胺類', en: 'Sulfa drugs', ja: 'スルファ剤', ko: '설폰아미드', vi: 'Thuốc sulfa', id: 'Obat sulfa' },
    { zh: '非類固醇抗發炎藥', en: 'NSAIDs', ja: 'NSAIDs（非ステロイド性抗炎症薬）', ko: 'NSAIDs', vi: 'Thuốc chống viêm NSAIDs', id: 'NSAID' },
    { zh: '造影劑', en: 'Contrast dye', ja: '造影剤', ko: '조영제', vi: 'Thuốc cản quang', id: 'Kontras' },
    { zh: '麻藥', en: 'Local anesthetics', ja: '局所麻酔薬', ko: '국소 마취제', vi: 'Thuốc gây tê', id: 'Anestesi lokal' },
    { zh: '頭孢菌素', en: 'Cephalosporins', ja: 'セフェム系', ko: '세팔로스포린', vi: 'Kháng sinh cephalosporin', id: 'Sefalosporin' },
  ],
};
