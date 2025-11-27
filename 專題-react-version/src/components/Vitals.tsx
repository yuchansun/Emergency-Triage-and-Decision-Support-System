import React, { useState, useRef } from 'react';

type VitalsProps = {
  gender?: '男' | '女' | '不詳' | '';  // 對應 AddPatient 的性別
};

const Vitals: React.FC<VitalsProps> = ({ gender }) => {
  // === 生命徵象欄位 ===
  const [temperature, setTemperature] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [respRate, setRespRate] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [systolicBP, setSystolicBP] = useState<string>('');
  const [diastolicBP, setDiastolicBP] = useState<string>('');
  const [bloodSugar, setBloodSugar] = useState<string>('');

  // === 既有狀態 ===
  const [bloodSugarLevel, setBloodSugarLevel] = useState<string | null>(null);
  const [gcsEye, setGcsEye] = useState<string | null>(null);
  const [gcsVerbal, setGcsVerbal] = useState<string | null>(null);
  const [gcsMotor, setGcsMotor] = useState<string | null>(null);
  const [obHistory, setObHistory] = useState<string | null>(null);
  const [pastHistory, setPastHistory] = useState<string[]>([]);
  const [drugAllergy, setDrugAllergy] = useState<string | null>(null);
  const [painScore, setPainScore] = useState<number | null>(null);
  const eyeInputRef = useRef<HTMLInputElement | null>(null);
  const verbalInputRef = useRef<HTMLInputElement | null>(null);
  const motorInputRef = useRef<HTMLInputElement | null>(null);

  const togglePastHistory = (label: string) => {
    setPastHistory((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

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
  const weightVal = toNumber(weight);
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
    "form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary";

  const baseSmallInputClass =
    "form-input w-20 rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary";

  const errorInputClass =
    " border-red-500 ring-1 ring-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500";

  const errorTextClass = "mt-1 text-xs text-red-500";

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-xl shadow-lg w-full">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">生命徵象</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* 體溫 / 脈搏 / SPO2 */}
        <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="temperature">體溫 (°C)</label>
            <input
              id="temperature"
              type="number"
              placeholder="例如 37.5"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={baseInputClass + (isTempAbnormal ? errorInputClass : "")}
            />
            {isTempAbnormal && (
              <p className={errorTextClass}>超出一般成人正常範圍 (約 35–38°C)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="heart-rate">脈搏 (次/分)</label>
            <input
              id="heart-rate"
              type="number"
              placeholder="例如 80"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              className={baseInputClass + (isHeartRateAbnormal ? errorInputClass : "")}
            />
            {isHeartRateAbnormal && (
              <p className={errorTextClass}>超出一般成人正常範圍 (約 60–100 次/分)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="spo2">SPO2 (%)</label>
            <input
              id="spo2"
              type="number"
              placeholder="例如 98"
              value={spo2}
              onChange={(e) => setSpo2(e.target.value)}
              className={baseInputClass + (isSpo2Abnormal ? errorInputClass : "")}
            />
            {isSpo2Abnormal && (
              <p className={errorTextClass}>可能偏低，建議進一步評估</p>
            )}
          </div>
        </div>

        {/* 呼吸 / 體重 */}
        <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="respiratory-rate">呼吸 (次/分)</label>
            <input
              id="respiratory-rate"
              type="number"
              placeholder="例如 18"
              value={respRate}
              onChange={(e) => setRespRate(e.target.value)}
              className={baseInputClass + (isRespAbnormal ? errorInputClass : "")}
            />
            {isRespAbnormal && (
              <p className={errorTextClass}>超出一般成人正常範圍 (約 12–20 次/分)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="weight">體重 (公斤)</label>
            <input
              id="weight"
              type="number"
              placeholder="例如 70"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={baseInputClass + (isWeightAbnormal ? errorInputClass : "")}
            />
            {/* 體重暫時不給警示文字，如需要可自行加上 */}
          </div>
        </div>

        {/* 血壓 & 血糖 */}
        <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="systolic-bp">血壓 (mmHg)</label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  id="systolic-bp"
                  type="number"
                  placeholder="120"
                  value={systolicBP}
                  onChange={(e) => setSystolicBP(e.target.value)}
                  className={baseInputClass + (isSysAbnormal ? errorInputClass : "")}
                />
                <span className="text-subtext-light dark:text-subtext-dark">/</span>
                <input
                  id="diastolic-bp"
                  type="number"
                  placeholder="80"
                  value={diastolicBP}
                  onChange={(e) => setDiastolicBP(e.target.value)}
                  className={baseInputClass + (isDiaAbnormal ? errorInputClass : "")}
                />
              </div>
              {(isSysAbnormal || isDiaAbnormal) && (
                <p className={errorTextClass}>超出一般成人正常範圍 (約 90–140 / 60–90 mmHg)</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="blood-sugar">BS (血糖)</label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  id="blood-sugar"
                  type="number"
                  placeholder="例如 90"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                  className={baseInputClass + (isBloodSugarAbnormal ? errorInputClass : "")}
                />
                <button
                  className={
                    "flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors" +
                    (bloodSugarLevel === 'Low' ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                  }
                  onClick={() => setBloodSugarLevel('Low')}
                  type="button"
                >
                  Low
                </button>
                <button
                  className={
                    "flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors" +
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

        {/*  GCS（三個輸入框版本 E / V / M） */}
<div className="space-y-2 col-span-1 md:col-span-2">
  <label className="text-sm font-medium whitespace-nowrap">GCS (E / V / M)</label>

  <div className="flex items-center gap-4">
    {/* Eye */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">E</span>
      <input
        ref={eyeInputRef}
        type="number"
        min={1}
        max={4}
        value={gcsEye ?? ""}
        onChange={(e) => {
          const val = e.target.value;

          // 清空時
          if (val === "") {
            setGcsEye(null);
            return;
          }

          setGcsEye(val);

          // 輸入一個數字後，自動跳到 V
          if (val.length >= 1) {
            verbalInputRef.current?.focus();
            verbalInputRef.current?.select(); // 順便選取，方便重改
          }
        }}
        placeholder="1–4"
        className={baseSmallInputClass}
      />
    </div>

    {/* Verbal */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">V</span>
      <input
        ref={verbalInputRef}
        type="number"
        min={1}
        max={5}
        value={gcsVerbal ?? ""}
        onChange={(e) => {
          const val = e.target.value;

          if (val === "") {
            setGcsVerbal(null);
            return;
          }

          setGcsVerbal(val);

          // 輸入一個數字後，自動跳到 M
          if (val.length >= 1) {
            motorInputRef.current?.focus();
            motorInputRef.current?.select();
          }
        }}
        placeholder="1–5"
        className={baseSmallInputClass}
      />
    </div>

    {/* Motor */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">M</span>
      <input
        ref={motorInputRef}
        type="number"
        min={1}
        max={6}
        value={gcsMotor ?? ""}
        onChange={(e) => {
          const val = e.target.value;

          if (val === "") {
            setGcsMotor(null);
            return;
          }

          setGcsMotor(val);
          // 這邊通常不再往後跳，就不做事
        }}
        placeholder="1–6"
        className={baseSmallInputClass}
      />
    </div>
  </div>

  <div className="text-sm text-subtext-light dark:text-subtext-dark">
    <span>Eye: {gcsEye || "-"}　</span>
    <span>Verbal: {gcsVerbal || "-"}　</span>
    <span>Motor: {gcsMotor || "-"}</span>
  </div>
</div>


        {/* 只有性別為「女」時才顯示產科史 */}
        {gender === '女' && (
          <fieldset className="col-span-1 md:col-span-2">
            <legend className="block text-sm font-medium pb-1">產科史</legend>
            <div className="flex items-start gap-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['無月經/停經','有懷孕','無懷孕','不確定'].map(label => (
                  <button
                    key={label}
                    type="button"
                    className={ 
                      "flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2" +
                      (obHistory === label ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                    }
                    onClick={() => setObHistory(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium pb-1" htmlFor="lmp">LMP (最後月經日期)</label>
                  <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="lmp" type="date" />
                </div>
                <div>
                  <label className="block text-xs font-medium pb-1" htmlFor="edc">EDC (預產期)</label>
                  <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="edc" type="date" />
                </div>
              </div>
            </div>
          </fieldset>
        )}

        {/* 過去病史 */}
        <fieldset className="col-span-1 md:col-span-2">
  <legend className="block text-sm font-medium pb-2">過去病史</legend>
  <div className="flex flex-wrap gap-2 z-10 relative">
    {['無','高血壓','糖尿病','心臟病','肺部疾病','癌症','禁治療','其他'].map(label => {
      const isSelected = pastHistory.includes(label);

      return (
        <button
          key={label}
          type="button"
          onClick={() => togglePastHistory(label)}
          className={
            "px-3 py-1.5 rounded-full text-sm transition-colors border " +
            (isSelected
              ? "bg-primary text-white border-primary"
              : "bg-white dark:bg-background-dark text-primary border-primary/30 hover:bg-primary/10")
          }
        >
          {label}
        </button>
      );
    })}
  </div>

  <div className="grid grid-cols-2 gap-4 mt-2">
    <input
      className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary"
      id="no-treatment-details"
      placeholder="禁治療詳情（如：DNR、DNI 等）"
      type="text"
    />
    <input
      className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary"
      id="other-history-details"
      placeholder="其他病史詳情"
      type="text"
    />
  </div>
</fieldset>


        {/* 藥物過敏 */}
        <fieldset className="col-span-1 md:col-span-2">
  <legend className="block text-sm font-medium pb-2">藥物過敏</legend>

  <div className="flex flex-wrap gap-2 z-10 relative">
    {['無','不詳','有'].map(label => {
      const isSelected = drugAllergy === label;

      return (
        <button
          key={label}
          type="button"
          onClick={() => setDrugAllergy(label)}
          className={
            "px-3 py-1.5 rounded-full text-sm transition-colors border " +
            (isSelected
              ? "bg-primary text-white border-primary"
              : "bg-white dark:bg-background-dark text-primary border-primary/30 hover:bg-primary/10")
          }
        >
          {label}
        </button>
      );
    })}
  </div>

  <input
    className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary mt-2"
    id="allergy-details"
    placeholder="藥物過敏詳情（如：盤尼西林、阿斯匹靈等）"
    type="text"
  />
</fieldset>


        {/* 疼痛指數 */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium pb-2">疼痛指數~ (0-10)</label>
          <div className="grid grid-cols-11 gap-1">
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
              <button
                key={value}
                type="button"
                className={
                  "flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2" +
                  (painScore === value ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                }
                onClick={() => setPainScore(value)}
              >
                <span className="material-symbols-outlined text-lg">{icon}</span>
                <span className="ml-1 font-bold">{value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vitals;
