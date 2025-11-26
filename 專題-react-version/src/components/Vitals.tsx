import React, { useState } from 'react';

type VitalsProps = {
  gender?: '男' | '女' | '不詳' | '';  // 對應 AddPatient 的性別
};

const Vitals: React.FC<VitalsProps> = ({ gender }) => {
  const [bloodSugarLevel, setBloodSugarLevel] = useState<string | null>(null);
  const [gcsEye, setGcsEye] = useState<string | null>(null);
  const [gcsVerbal, setGcsVerbal] = useState<string | null>(null);
  const [gcsMotor, setGcsMotor] = useState<string | null>(null);
  const [obHistory, setObHistory] = useState<string | null>(null);
  const [pastHistory, setPastHistory] = useState<string[]>([]);
  const [drugAllergy, setDrugAllergy] = useState<string | null>(null);
  const [painScore, setPainScore] = useState<number | null>(null);

  const togglePastHistory = (label: string) => {
    console.log('pastHistory before:', pastHistory); // 追蹤 pastHistory 的變化
    setPastHistory((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
    console.log('pastHistory after:', pastHistory); // 查看變化後的結果
  };

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-xl shadow-lg w-full">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">生命徵象</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="temperature">體溫 (°C)</label>
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="temperature" placeholder="例如 37.5" type="number" />
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="heart-rate">脈搏 (次/分)</label>
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="heart-rate" placeholder="例如 80" type="number" />
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="spo2">SPO2 (%)</label>
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="spo2" placeholder="例如 98" type="number" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="respiratory-rate">呼吸 (次/分)</label>
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="respiratory-rate" placeholder="例如 18" type="number" />
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="weight">體重 (公斤)</label>
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="weight" placeholder="例如 70" type="number" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="systolic-bp">血壓 (mmHg)</label>
            <div className="flex items-center gap-2">
              <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="systolic-bp" placeholder="120" type="number" />
              <span className="text-subtext-light dark:text-subtext-dark">/</span>
              <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="diastolic-bp" placeholder="80" type="number" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium pb-2" htmlFor="blood-sugar">BS (血糖)</label>
            <div className="flex items-center gap-2">
              <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="blood-sugar" placeholder="例如 90" type="number" />
              <button
                className={
                  "flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors" +
                  (bloodSugarLevel === 'Low' ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                }
                onClick={() => setBloodSugarLevel('Low')}
              >
                Low
              </button>
              <button
                className={
                  "flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors" +
                  (bloodSugarLevel === 'High' ? " bg-primary text-white border-primary hover:bg-primary/90" : "")
                }
                onClick={() => setBloodSugarLevel('High')}
              >
                High
              </button>
            </div>
          </div>
        </div>


{/* 🔵 GCS（三個輸入框版本 E / V / M） */}
<div className="space-y-2 col-span-1 md:col-span-2">
  <label className="text-sm font-medium whitespace-nowrap">GCS (E / V / M)</label>

  <div className="flex items-center gap-4">
    {/* Eye */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">E</span>
      <input
        type="number"
        min={1}
        max={4}
        value={gcsEye ?? ""}
        onChange={(e) => setGcsEye(e.target.value)}
        placeholder="1–4"
        className="form-input w-20 rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary"
      />
    </div>

    {/* Verbal */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">V</span>
      <input
        type="number"
        min={1}
        max={5}
        value={gcsVerbal ?? ""}
        onChange={(e) => setGcsVerbal(e.target.value)}
        placeholder="1–5"
        className="form-input w-20 rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary"
      />
    </div>

    {/* Motor */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">M</span>
      <input
        type="number"
        min={1}
        max={6}
        value={gcsMotor ?? ""}
        onChange={(e) => setGcsMotor(e.target.value)}
        placeholder="1–6"
        className="form-input w-20 rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary"
      />
    </div>
  </div>

  {/* 顯示結果（可保留也可刪掉） */}
  <div className="text-sm text-subtext-light dark:text-subtext-dark">
  <span>Eye: {gcsEye || "-"}　</span> 
  <span>Verbal: {gcsVerbal || "-"}　</span>   
  <span>Motor: {gcsMotor || "-"}</span>
  </div>
</div>


        {/* 👇 只有性別為「女」時才顯示產科史 */}
        {gender === '女' && (
          <fieldset className="col-span-1 md:col-span-2">
            <legend className="block text-sm font-medium pb-1">產科史</legend>
            <div className="flex items-start gap-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['無月經/停經','有懷孕','無懷孕','不確定'].map(label => (
                  <button
                    key={label}
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

        <fieldset className="col-span-1 md:col-span-2">
          <legend className="block text-sm font-medium pb-2">過去病史</legend>
          <div className="flex flex-wrap gap-2 z-10 relative">
            {['無','高血壓','糖尿病','心臟病','肺部疾病','癌症','禁治療','其他'].map(label => (
              <button
                key={label}
                className={ 
                  "symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors" +
                  (pastHistory.includes(label) ? " bg-primary text-white hover:bg-primary/90" : "")
                }
                onClick={() => togglePastHistory(label)}
              >
                {label}
              </button>
            ))}
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

        <fieldset className="col-span-1 md:col-span-2">
          <legend className="block text-sm font-medium pb-2">藥物過敏</legend>
          <div className="flex flex-wrap gap-2 z-10 relative">
            {['無','不詳','有'].map(label => (
              <button
                key={label}
                className={
                  "symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors" +
                  (drugAllergy === label ? " bg-primary text-white hover:bg-primary/90" : "")
                }
                onClick={() => setDrugAllergy(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary mt-2"
            id="allergy-details"
            placeholder="藥物過敏詳情（如：盤尼西林、阿斯匹靈等）"
            type="text"
          />
        </fieldset>


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
