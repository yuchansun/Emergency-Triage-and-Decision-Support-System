import React, { useState, useRef } from 'react';
import FieldHelpButton from './FieldHelpModal';
import { PAST_HISTORY_HELP, DRUG_ALLERGY_HELP } from '../config/medicalHistoryHelp';

export type VitalsState = {
  temperature: string;
  heartRate: string;
  spo2: string;
  respRate: string;
  weight: string;
  systolicBP: string;
  diastolicBP: string;
  bloodSugar: string;
  bloodSugarLevel: string | null;
  gcsEye: string | null;
  gcsVerbal: string | null;
  gcsMotor: string | null;
  obHistory: string | null;
  pastHistory: string[];
  otherHistoryDetails: string;
  drugAllergy: string | null;
  painScore: number | null;
  doNotTreat: string;
  sentiment: number | null;
};

export type VitalsProps = {
  gender?: '男' | '女' | '不詳' | '';
  vitals?: VitalsState;
  setVitals?: React.Dispatch<React.SetStateAction<VitalsState>>;
  highlightHistoricalDrugAllergy?: boolean;
  highlightHistoricalPastHistory?: boolean;
  highlightHistoricalDoNotTreat?: boolean;
};

const Vitals: React.FC<VitalsProps> = ({
  gender,
  vitals = {  // ← 改成完整的預設值
    temperature: '',
    heartRate: '',
    spo2: '',
    respRate: '',
    weight: '',
    systolicBP: '',
    diastolicBP: '',
    bloodSugar: '',
    bloodSugarLevel: null,
    gcsEye: null,
    gcsVerbal: null,  // ← 現在有這個屬性了
    gcsMotor: null,
    obHistory: null,
    pastHistory: [],
    otherHistoryDetails: '',
    drugAllergy: null,
    painScore: null,
    doNotTreat: '',
    sentiment: null,
  },
  setVitals = () => { },
  highlightHistoricalDrugAllergy = false,
  highlightHistoricalPastHistory = false,
  highlightHistoricalDoNotTreat = false,
}) => {
  // === 移除所有 local useState，改成從 props 讀取 ===
  // 例如：原本 const [temperature, setTemperature] = useState<string>('');
  // 現在改成：
  const temperature = vitals.temperature || '';
  const setTemperature = (val: string) => {
    console.log('[Vitals] setTemperature called with:', val);
    console.log('[Vitals] current vitals before update:', vitals);
    const newVitals = { ...vitals, temperature: val };
    console.log('[Vitals] new vitals after update:', newVitals);
    setVitals(newVitals);
  };

  const heartRate = vitals.heartRate || '';
  const setHeartRate = (val: string) => setVitals({ ...vitals, heartRate: val });

  const spo2 = vitals.spo2 || '';
  const setSpo2 = (val: string) => setVitals({ ...vitals, spo2: val });

  const respRate = vitals.respRate || '';
  const setRespRate = (val: string) => setVitals({ ...vitals, respRate: val });

  const weight = vitals.weight || '';
  const setWeight = (val: string) => setVitals({ ...vitals, weight: val });

  const systolicBP = vitals.systolicBP || '';
  const setSystolicBP = (val: string) => setVitals({ ...vitals, systolicBP: val });

  const diastolicBP = vitals.diastolicBP || '';
  const setDiastolicBP = (val: string) => setVitals({ ...vitals, diastolicBP: val });

  const bloodSugar = vitals.bloodSugar || '';
  const setBloodSugar = (val: string) => setVitals({ ...vitals, bloodSugar: val });

  const bloodSugarLevel = vitals.bloodSugarLevel;
  const setBloodSugarLevel = (val: string | null) => setVitals({ ...vitals, bloodSugarLevel: val });

  const gcsEye = vitals.gcsEye;
  const setGcsEye = (val: string | null) => setVitals({ ...vitals, gcsEye: val });

  const gcsVerbal = vitals.gcsVerbal;
  const setGcsVerbal = (val: string | null) => setVitals({ ...vitals, gcsVerbal: val });

  const gcsMotor = vitals.gcsMotor;
  const setGcsMotor = (val: string | null) => setVitals({ ...vitals, gcsMotor: val });

  const obHistory = vitals.obHistory;
  const setObHistory = (val: string | null) => setVitals({ ...vitals, obHistory: val });

  const pastHistory = vitals.pastHistory || [];
  const otherHistoryDetails = vitals.otherHistoryDetails || '';
  const setOtherHistoryDetails = (val: string) => setVitals({ ...vitals, otherHistoryDetails: val });

  const drugAllergy = vitals.drugAllergy;
  const parseDrugAllergy = (raw: string | null): { status: string | null; detail: string } => {
    const value = String(raw || '').trim();
    if (!value) return { status: null, detail: '' };
    if (value.startsWith('有-')) return { status: '有', detail: value.slice(2).trim() };
    if (value === '有' || value === '無' || value === '不詳') return { status: value, detail: '' };
    return { status: '有', detail: value };
  };
  const formatDrugAllergy = (status: string | null, detail: string): string | null => {
    if (!status) return null;
    if (status === '有') {
      const normalizedDetail = detail.trim();
      return normalizedDetail ? `有-${normalizedDetail}` : '有';
    }
    return status;
  };
  const allergyParsed = parseDrugAllergy(drugAllergy);
  const setDrugAllergy = (status: string | null, detail: string = allergyParsed.detail) =>
    setVitals(prev => ({
      ...prev,
      drugAllergy: formatDrugAllergy(status, detail)
    }));
  const painScore = vitals.painScore;
  const setPainScore = (val: number | null) => setVitals({ ...vitals, painScore: val });

  const doNotTreat = vitals.doNotTreat || '';
  const setDoNotTreat = (val: string) => setVitals({ ...vitals, doNotTreat: val });

  const sentiment = vitals.sentiment;
  const setSentiment = (val: number | null) => setVitals({ ...vitals, sentiment: val });

  const PAST_HISTORY_QUICK = ['無', '高血壓', '糖尿病', '心臟病', '肺部疾病', '癌症'];

  const applyPastHistoryItem = (label: string) => {
    if (PAST_HISTORY_QUICK.includes(label)) {
      if (pastHistory.includes(label)) return;
      setVitals((prev) => {
        const ph = (prev.pastHistory || []).filter((item) => item !== '無');
        return { ...prev, pastHistory: [...ph, label] };
      });
      return;
    }
    const current = otherHistoryDetails.trim();
    if (current.split(/[、,，]/).map((s) => s.trim()).includes(label)) return;
    setOtherHistoryDetails(current ? `${current}、${label}` : label);
  };

  const applyDrugAllergyItem = (label: string) => {
    const current = allergyParsed.detail.trim();
    if (current.split(/[、,，]/).map((s) => s.trim()).includes(label)) return;
    setDrugAllergy('有', current ? `${current}、${label}` : label);
  };

  // === togglePastHistory 改成更新 props ===
  const togglePastHistory = (label: string) => {
    const removing = pastHistory.includes(label);
    setVitals((prev) => {
      const ph = prev.pastHistory || [];
      const newPastHistory = removing ? ph.filter((item) => item !== label) : [...ph, label];
      return {
        ...prev,
        pastHistory: newPastHistory,
        ...(removing && label === '禁治療' ? { doNotTreat: '' } : {}),
      };
    });
    if (removing && label === '其他') {
      setOtherHistoryDetails('');
    }
  };

  // === 其餘程式碼保持不變 ===
  // （異常判斷、樣式等都一樣，只是變數來源改了）

  // === 共用：字串轉 number，小心空字串 ===
  const toNumber = (value: string): number | null => {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    return n;
  };

  // === 各欄位異常判斷（可依照醫院標準自行調整） ===
  const tempVal = toNumber(temperature);
  const heartRateVal = toNumber(heartRate);
  const spo2Val = toNumber(spo2);
  const respRateVal = toNumber(respRate);
  const sysVal = toNumber(systolicBP);
  const diaVal = toNumber(diastolicBP);
  const bsVal = toNumber(bloodSugar);

  const isTempAbnormal =
    tempVal !== null && (tempVal < 35 || tempVal > 38);

  const isHeartRateAbnormal =
    heartRateVal !== null && (heartRateVal < 60 || heartRateVal > 100);

  const isSpo2Abnormal =
    spo2Val !== null && spo2Val < 94;

  const isRespAbnormal =
    respRateVal !== null && (respRateVal < 12 || respRateVal > 20);

  // 體重多半不做「異常紅框」，這裡先設為永遠正常，需要也可加判斷
  const isWeightAbnormal = false;

  const isSysAbnormal =
    sysVal !== null && (sysVal < 90 || sysVal > 140);

  const isDiaAbnormal =
    diaVal !== null && (diaVal < 60 || diaVal > 90);

  const isBloodSugarAbnormal =
    bsVal !== null && (bsVal < 70 || bsVal > 140);

  // === 共用樣式 ===
  const baseInputClass =
    "form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 focus:ring-primary focus:border-primary";

  /** GCS 數字欄（ring-inset：在 overflow-x-auto 內 focus 不會被裁切） */
  const gcsInputClass =
    "form-input w-[4.75rem] min-w-[4.75rem] shrink-0 rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 focus:border-primary";

  const weightInputClass =
    "form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-3 text-sm focus:ring-primary focus:border-primary";

  const errorInputClass =
    " border-red-500 ring-1 ring-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500";

  const errorTextClass = "mt-1 text-xs text-red-500";

  // === 新增：其他病史詳情的 state（如果需要存到 vitals，可以加到 vitals 物件中）
  // 這裡先用 local state，因為資料庫沒有這個欄位
  const [painExpanded, setPainExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);

  // GCS auto-advance refs
  const gcsEyeRef = useRef<HTMLInputElement | null>(null);
  const gcsVerbalRef = useRef<HTMLInputElement | null>(null);
  const gcsMotorRef = useRef<HTMLInputElement | null>(null);

  // 藥物過敏詳情由 vitals.drugAllergy 解析，不再使用 local state，避免未儲存
  const allergyDetails = allergyParsed.detail;
  const setAllergyDetails = (val: string) => setDrugAllergy('有', val);
  const showHistoricalAllergy = highlightHistoricalDrugAllergy && Boolean(drugAllergy);
  const showHistoricalPastHistory = highlightHistoricalPastHistory && pastHistory.length > 0;
  const showHistoricalDoNotTreat = highlightHistoricalDoNotTreat && Boolean(doNotTreat.trim());

  // === 新增：LMP/EDC 的 local state（如果不需要存到資料庫）
  const [lmp, setLmp] = useState<string>('');
  const [edc, setEdc] = useState<string>('');

  return (
    <div className="bg-content-light dark:bg-content-dark p-4 rounded-xl shadow-lg w-full">
      <h3 className="text-xl font-bold mb-3 flex items-center gap-2">生命徵象</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        {/* 體溫 / 脈搏 / SPO2 */}
        <div className="grid grid-cols-3 gap-3 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-1" htmlFor="temperature">體溫 (°C)</label>
            <input
              id="temperature"
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={baseInputClass + (isTempAbnormal ? errorInputClass : "")}
            />
            {isTempAbnormal && (
              <p className={errorTextClass}>超出一般成人正常範圍 (約 35–38°C)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium pb-1" htmlFor="heart-rate">脈搏 (次/分)</label>
            <input
              id="heart-rate"
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              className={baseInputClass + (isHeartRateAbnormal ? errorInputClass : "")}
            />
            {isHeartRateAbnormal && (
              <p className={errorTextClass}>超出一般成人正常範圍 (約 60–100 次/分)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium pb-1" htmlFor="spo2">SPO2 (%)</label>
            <input
              id="spo2"
              type="number"
              value={spo2}
              onChange={(e) => setSpo2(e.target.value)}
              className={baseInputClass + (isSpo2Abnormal ? errorInputClass : "")}
            />
            {isSpo2Abnormal && (
              <p className={errorTextClass}>可能偏低，建議進一步評估</p>
            )}
          </div>
        </div>

        {/* 呼吸 / 血壓 / BS（血糖） */}
        <div className="grid grid-cols-3 gap-3 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-1" htmlFor="respiratory-rate">呼吸 (次/分)</label>
            <input
              id="respiratory-rate"
              type="number"
              value={respRate}
              onChange={(e) => setRespRate(e.target.value)}
              className={baseInputClass + (isRespAbnormal ? errorInputClass : "")}
            />
            {isRespAbnormal && (
              <p className={errorTextClass}>超出一般成人正常範圍 (約 12–20 次/分)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium pb-1" htmlFor="systolic-bp">血壓 (mmHg)</label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <input
                  id="systolic-bp"
                  type="number"
                  value={systolicBP}
                  onChange={(e) => setSystolicBP(e.target.value)}
                  className={`${baseInputClass} flex-1 min-w-0${isSysAbnormal ? errorInputClass : ""}`}
                />
                <span className="text-subtext-light dark:text-subtext-dark shrink-0">/</span>
                <input
                  id="diastolic-bp"
                  type="number"
                  value={diastolicBP}
                  onChange={(e) => setDiastolicBP(e.target.value)}
                  className={`${baseInputClass} flex-1 min-w-0${isDiaAbnormal ? errorInputClass : ""}`}
                />
              </div>
              {(isSysAbnormal || isDiaAbnormal) && (
                <p className={errorTextClass}>超出一般成人正常範圍 (約 90–140 / 60–90 mmHg)</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium pb-1" htmlFor="blood-sugar">BS (血糖)</label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  id="blood-sugar"
                  type="number"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                  className={`${baseInputClass} !w-[5.75rem] min-w-[5.75rem] shrink-0${isBloodSugarAbnormal ? errorInputClass : ""}`}
                />
                <button
                  className={
                    "flex items-center justify-center h-9 w-12 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors shrink-0" +
                    (bloodSugarLevel === 'Low' ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                  }
                  onClick={() => setBloodSugarLevel('Low')}
                  type="button"
                >
                  Low
                </button>
                <button
                  className={
                    "flex items-center justify-center h-9 w-12 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors shrink-0" +
                    (bloodSugarLevel === 'High' ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                  }
                  onClick={() => setBloodSugarLevel('High')}
                  type="button"
                >
                  High
                </button>
              </div>
              {isBloodSugarAbnormal && (
                <p className={errorTextClass}>超出一般空腹血糖範圍 (約 70–140 mg/dL)</p>
              )}
            </div>
          </div>
        </div>

        {/* GCS + 體重：用 grid 固定左 GCS、右體重，避免小於 md 時 flex-col 變兩列全寬 */}
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_13.5rem] gap-x-4 gap-y-2 items-start col-span-1 md:col-span-2 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <label className="text-sm font-medium whitespace-nowrap">GCS (E / V / M)</label>
            {/* py：避免 overflow-x-auto 裁切 focus ring；橫向捲動列仍維持單行 */}
            <div className="mt-1.5 flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto overscroll-x-contain px-0.5 py-1 [-webkit-overflow-scrolling:touch] sm:gap-x-2.5">
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="whitespace-nowrap text-sm font-medium leading-none">
                  E<span className="text-xs font-normal text-subtext-light dark:text-subtext-dark">(1~4)</span>
                </span>
                <input
                  ref={gcsEyeRef}
                  type="number"
                  min={1}
                  max={4}
                  title="E：1~4"
                  value={gcsEye ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : e.target.value;
                    setGcsEye(v);
                    if (v) gcsVerbalRef.current?.focus();
                  }}
                  className={gcsInputClass}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="whitespace-nowrap text-sm font-medium leading-none">
                  V<span className="text-xs font-normal text-subtext-light dark:text-subtext-dark">(1~5)</span>
                </span>
                <input
                  ref={gcsVerbalRef}
                  type="number"
                  min={1}
                  max={5}
                  title="V：1~5"
                  value={gcsVerbal ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : e.target.value;
                    setGcsVerbal(v);
                    if (v) gcsMotorRef.current?.focus();
                  }}
                  className={gcsInputClass}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="whitespace-nowrap text-sm font-medium leading-none">
                  M<span className="text-xs font-normal text-subtext-light dark:text-subtext-dark">(1~6)</span>
                </span>
                <input
                  ref={gcsMotorRef}
                  type="number"
                  min={1}
                  max={6}
                  title="M：1~6"
                  value={gcsMotor ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : e.target.value;
                    setGcsMotor(v);
                  }}
                  className={gcsInputClass}
                />
              </div>
            </div>
          </div>
          <div className="flex min-w-0 w-full max-w-full flex-col gap-1.5 justify-self-stretch">
            <label className="block text-sm font-medium pb-1" htmlFor="weight">體重 (公斤)</label>
            <input
              id="weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={weightInputClass + (isWeightAbnormal ? errorInputClass : "")}
            />
          </div>
        </div>

        {/* 產科史 */}
        {gender === '女' && (
          <fieldset className="col-span-1 md:col-span-2 border-0 p-0 m-0 min-w-0">
            <legend className="sr-only">產科史</legend>
            <div className="flex min-w-0 flex-nowrap items-end gap-x-1.5 gap-y-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium leading-none">產科史</span>
                <div className="flex flex-nowrap items-center gap-1.5">
                  {['無月經/停經', '有懷孕', '無懷孕', '不確定'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className={
                        "flex items-center justify-center h-9 min-h-[2.25rem] text-xs sm:text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2 whitespace-nowrap" +
                        (obHistory === label ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                      }
                      onClick={() => setObHistory(obHistory === label ? null : label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ml-4 flex min-w-0 flex-nowrap items-end gap-x-2 pl-1">
                <div className="w-[min(100%,9.75rem)] shrink-0">
                  <label className="block text-xs font-medium pb-1 whitespace-nowrap" htmlFor="lmp">
                    LMP (最後月經日期)
                  </label>
                  <input
                    value={lmp}
                    onChange={(e) => setLmp(e.target.value)}
                    className="form-input w-full max-w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-2 text-sm focus:ring-primary focus:border-primary"
                    id="lmp"
                    type="date"
                  />
                </div>
                <div className="w-[min(100%,9.75rem)] shrink-0">
                  <label className="block text-xs font-medium pb-1 whitespace-nowrap" htmlFor="edc">
                    EDC (預產期)
                  </label>
                  <input
                    value={edc}
                    onChange={(e) => setEdc(e.target.value)}
                    className="form-input w-full max-w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-2 text-sm focus:ring-primary focus:border-primary"
                    id="edc"
                    type="date"
                  />
                </div>
              </div>
            </div>
          </fieldset>
        )}

        {/* 過去病史 */}
        <fieldset className="col-span-1 md:col-span-2">
          <legend className="flex items-center text-sm font-medium pb-1">
            過去病史
            <FieldHelpButton
              content={PAST_HISTORY_HELP}
              onSelectItem={(item) => applyPastHistoryItem(item.zh)}
            />
          </legend>
          <div className="flex flex-wrap gap-2 z-10 relative">
            {PAST_HISTORY_QUICK.map(label => {
              const isSelected = pastHistory.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => togglePastHistory(label)}
                  className={
                    "px-3 py-1 rounded-full text-sm transition-colors border " +
                    (isSelected
                      ? showHistoricalPastHistory
                        ? "bg-red-50 text-red-600 border-red-400 font-semibold"
                        : "bg-primary text-white border-primary"
                      : "bg-white dark:bg-background-dark text-primary border-primary/30 hover:bg-primary/10")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-row gap-2 items-center flex-wrap">
            <input
              value={doNotTreat}
              onChange={(e) => setDoNotTreat(e.target.value)}
              placeholder="禁治療詳情（如：DNR、DNI 等）"
              type="text"
              className={
                "form-input w-full sm:flex-1 sm:min-w-[12rem] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-3 text-sm focus:ring-primary focus:border-primary" +
                (showHistoricalDoNotTreat ? " border-red-400 text-red-600 font-semibold" : "")
              }
            />
            <input
              value={otherHistoryDetails}
              onChange={(e) => setOtherHistoryDetails(e.target.value)}
              placeholder="其他病史詳情"
              type="text"
              className={
                "form-input w-full sm:flex-1 sm:min-w-[12rem] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-3 text-sm focus:ring-primary focus:border-primary" +
                (showHistoricalPastHistory && otherHistoryDetails.trim()
                  ? " border-red-400 text-red-600 font-semibold"
                  : "")
              }
            />
          </div>
        </fieldset>

        {/* 藥物過敏 */}
        <fieldset className="col-span-1 md:col-span-2">
          <legend className="flex items-center text-sm font-medium pb-1">
            藥物過敏
            <FieldHelpButton
              content={DRUG_ALLERGY_HELP}
              onSelectItem={(item) => applyDrugAllergyItem(item.zh)}
            />
          </legend>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrugAllergy(allergyParsed.status === '不詳' ? null : '不詳')}
              className={
                "px-3 py-1 rounded-full text-sm transition-colors border " +
                (allergyParsed.status === '不詳'
                  ? showHistoricalAllergy
                    ? "bg-red-50 text-red-600 border-red-400 font-semibold"
                    : "bg-primary text-white border-primary"
                  : "bg-white dark:bg-background-dark text-primary border-primary/30 hover:bg-primary/10")
              }
            >
              不詳
            </button>
            {showHistoricalAllergy && allergyParsed.status === '無' && (
              <span className="text-red-600 font-semibold text-sm shrink-0">無</span>
            )}
            {showHistoricalAllergy && allergyParsed.status === '有' && !allergyDetails && (
              <span className="text-red-600 font-semibold text-sm shrink-0">有</span>
            )}
            <input
              value={allergyDetails}
              onChange={(e) => setAllergyDetails(e.target.value)}
              placeholder="藥物過敏詳情（如：盤尼西林、阿斯匹靈等）"
              type="text"
              className={
                "form-input w-full sm:flex-1 sm:min-w-[12rem] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-9 px-3 text-sm focus:ring-primary focus:border-primary" +
                (showHistoricalAllergy && allergyDetails ? " text-red-600 font-semibold" : "")
              }
            />
          </div>
        </fieldset>

        {/* 疼痛指數 + 心理/情緒狀態 同行 */}
        <div className="col-span-1 md:col-span-2 flex gap-4 relative">
          {/* 疼痛指數 */}
          <div className="flex-1 relative">
            <button
              type="button"
              className="flex items-center justify-between w-full text-sm font-medium py-1 px-2 rounded-lg border border-subtext-dark/20 bg-white dark:bg-background-dark hover:bg-primary/5"
              onClick={() => { setPainExpanded(v => !v); setSentimentExpanded(false); }}
            >
              <span>疼痛指數</span>
              <span className="flex items-center gap-1 text-primary font-bold">
                {painScore !== null ? (
                  <>
                    <span className="material-symbols-outlined text-base">
                      {painScore <= 1 ? 'sentiment_very_satisfied'
                      : painScore <= 4 ? 'sentiment_neutral'
                      : painScore <= 6 ? 'sentiment_dissatisfied'
                      : painScore <= 8 ? 'sentiment_very_dissatisfied'
                      : 'sick'}
                    </span>
                    {painScore}
                  </>
                ) : <span className="text-subtext-light dark:text-subtext-dark font-normal">-</span>}
                <span className="material-symbols-outlined text-sm">{painExpanded ? 'expand_less' : 'expand_more'}</span>
              </span>
            </button>
            {painExpanded && (
              <div className="absolute top-full left-0 z-50 mt-1 p-2 rounded-xl shadow-lg border border-subtext-dark/20 bg-white dark:bg-background-dark grid grid-cols-11 gap-1 w-max">
                {[
                  { icon: 'sentiment_very_satisfied', value: 0 },
                  { icon: 'sentiment_satisfied', value: 1 },
                  { icon: 'sentiment_satisfied', value: 2 },
                  { icon: 'sentiment_neutral', value: 3 },
                  { icon: 'sentiment_neutral', value: 4 },
                  { icon: 'sentiment_dissatisfied', value: 5 },
                  { icon: 'sentiment_dissatisfied', value: 6 },
                  { icon: 'sentiment_very_dissatisfied', value: 7 },
                  { icon: 'sentiment_very_dissatisfied', value: 8 },
                  { icon: 'sick', value: 9 },
                  { icon: 'sick', value: 10 },
                ].map(({ icon, value }) => (
                  <button key={value} type="button"
                    className={"flex items-center justify-center h-9 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-1.5" + (painScore === value ? " bg-primary text-white border-primary hover:bg-primary/90" : "")}
                    onClick={() => { setPainScore(value); setPainExpanded(false); }}>
                    <span className="material-symbols-outlined text-base">{icon}</span>
                    <span className="ml-1 font-bold">{value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 心理/情緒狀態 */}
          <div className="flex-1 relative">
            <button
              type="button"
              className="flex items-center justify-between w-full text-sm font-medium py-1 px-2 rounded-lg border border-subtext-dark/20 bg-white dark:bg-background-dark hover:bg-primary/5"
              onClick={() => { setSentimentExpanded(v => !v); setPainExpanded(false); }}
            >
              <span>心理/情緒狀態</span>
              <span className="flex items-center gap-1 text-primary font-bold">
                {sentiment !== null ? sentiment : <span className="text-subtext-light dark:text-subtext-dark font-normal">-</span>}
                <span className="material-symbols-outlined text-sm">{sentimentExpanded ? 'expand_less' : 'expand_more'}</span>
              </span>
            </button>
            {sentimentExpanded && (
              <div className="absolute top-full right-0 z-50 mt-1 p-2 rounded-xl shadow-lg border border-subtext-dark/20 bg-white dark:bg-background-dark grid grid-cols-11 gap-1 w-max">
                {[0,1,2,3,4,5,6,7,8,9,10].map(value => (
                  <button key={value} type="button"
                    className={"flex items-center justify-center h-9 w-9 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors" + (sentiment === value ? " bg-primary text-white border-primary hover:bg-primary/90" : "")}
                    onClick={() => { setSentiment(value); setSentimentExpanded(false); }}>
                    {value}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vitals;
