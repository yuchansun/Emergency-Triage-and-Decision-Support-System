import React from 'react';

const Vitals: React.FC = () => {
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
            <label className="block text-sm font-medium pb-2" htmlFor="respiratory-type">呼吸類型</label>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center h-12 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">無</button>
              <button className="flex items-center justify-center h-12 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">氣切管</button>
            </div>
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
              <button className="flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">Low</button>
              <button className="flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">High</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium pb-2">意識狀態</label>
            <div className="flex items-center gap-2">
              <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">無急性變化</button>
              <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">有急性變化</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium pb-2">是否直入急救室</label>
            <div className="flex items-center gap-2">
              <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">是</button>
              <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">否</button>
            </div>
          </div>
        </div>

        <div className="space-y-2 col-span-1 md:col-span-2">
          <label className="text-sm font-medium whitespace-nowrap">GCS - Eye (1-4)</label>
          <div className="grid grid-cols-6 gap-2">
            {['4','3','2','1'].map(n => (
              <button key={n} className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">{n}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2 col-span-1 md:col-span-2">
          <label className="text-sm font-medium whitespace-nowrap">GCS - Verbal (1-5)</label>
          <div className="grid grid-cols-6 gap-2">
            {['5','4','3','2','1'].map(n => (
              <button key={n} className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">{n}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2 col-span-1 md:col-span-2">
          <label className="text-sm font-medium whitespace-nowrap">GCS - Motor (1-6)</label>
          <div className="grid grid-cols-6 gap-2">
            {['6','5','4','3','2','1'].map(n => (
              <button key={n} className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">{n}</button>
            ))}
          </div>
        </div>

        <fieldset className="col-span-1 md:col-span-2">
          <legend className="block text-sm font-medium pb-1">產科史</legend>
          <div className="flex items-start gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['無月經/停經','有懷孕','無懷孕','不確定'].map(label => (
                <button key={label} className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2">{label}</button>
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

        <fieldset className="col-span-1 md:col-span-2">
          <legend className="block text-sm font-medium pb-2">過去病史</legend>
          <div className="flex flex-wrap gap-2">
            {['無','高血壓','糖尿病','心臟病','肺部疾病','癌症','禁治療','其他'].map(label => (
              <button key={label} className="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="no-treatment-details" placeholder="禁治療詳情（如：DNR、DNI 等）" type="text" />
            <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="other-history-details" placeholder="其他病史詳情" type="text" />
          </div>
        </fieldset>

        <fieldset className="col-span-1 md:col-span-2">
          <legend className="block text-sm font-medium pb-2">藥物過敏</legend>
          <div className="flex flex-wrap gap-2">
            {['無','不詳','有'].map(label => (
              <button key={label} className="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">{label}</button>
            ))}
          </div>
          <input className="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary mt-2" id="allergy-details" placeholder="藥物過敏詳情（如：盤尼西林、阿斯匹靈等）" type="text" />
        </fieldset>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium pb-2">疼痛指數 (0-10)</label>
          <div className="grid grid-cols-11 gap-1">
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_very_satisfied</span><span className="ml-1 font-bold">0</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_satisfied</span><span className="ml-1 font-bold">1</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_satisfied</span><span className="ml-1 font-bold">2</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_neutral</span><span className="ml-1 font-bold">3</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_neutral</span><span className="ml-1 font-bold">4</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_dissatisfied</span><span className="ml-1 font-bold">5</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_dissatisfied</span><span className="ml-1 font-bold">6</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_very_dissatisfied</span><span className="ml-1 font-bold">7</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sentiment_very_dissatisfied</span><span className="ml-1 font-bold">8</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sick</span><span className="ml-1 font-bold">9</span></button>
            <button className="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span className="material-symbols-outlined text-lg">sick</span><span className="ml-1 font-bold">10</span></button>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vitals;
