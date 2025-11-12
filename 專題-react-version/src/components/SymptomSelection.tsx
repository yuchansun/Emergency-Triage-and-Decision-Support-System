import React, { useState, useMemo } from 'react';

interface SymptomSelectionProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const SymptomSelection: React.FC<SymptomSelectionProps> = ({ selectedSymptoms, setSelectedSymptoms }) => {
  const [activeTab, setActiveTab] = useState<'t' | 'a' | 'e'>('t');
  const [tBody, setTBody] = useState<'head' | 'upper' | 'lower' | null>(null);
  const [aBody, setABody] = useState<'head' | 'upper' | 'lower' | null>(null);

  const bodyImgSrc = useMemo(() => {
    // Served from Vite public/ so path is stable in dev/build
    return '/人體圖.jpg';
  }, []);

  const toggleSelect = (key: string) => {
    setSelectedSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const tabBtnBase = 'flex flex-col items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold h-20 transition-colors cursor-pointer w-24';

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg flex-1 flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-2xl font-bold">選擇症狀</h3>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" data-tab="t" onClick={() => setActiveTab('t')} className={`symptom-tab ${tabBtnBase} ${activeTab === 't' ? 'bg-primary text-white' : ''}`}>
            <span className="text-xl font-bold">T</span>
            <span className="text-xs">外傷</span>
          </button>
          <button type="button" data-tab="a" onClick={() => setActiveTab('a')} className={`symptom-tab ${tabBtnBase} ${activeTab === 'a' ? 'bg-primary text-white' : ''}`}>
            <span className="text-xl font-bold">A</span>
            <span className="text-xs">非外傷</span>
          </button>
          <button type="button" data-tab="e" onClick={() => setActiveTab('e')} className={`symptom-tab ${tabBtnBase} ${activeTab === 'e' ? 'bg-primary text-white' : ''}`}>
            <span className="text-xl font-bold">E</span>
            <span className="text-xs">環境</span>
          </button>
        </div>
      </div>
      <div className="space-y-6 flex-1 flex flex-col">
        <div className="mt-4 space-y-4 flex-1 flex flex-col">
          <div data-tab-content="t" className={`symptom-panel flex-1 flex-col min-h-[450px] ${activeTab === 't' ? 'flex' : 'hidden'}`}>
            <div className="flex-1 flex flex-col">
              <h4 className="font-semibold text-lg mb-3">分類</h4>
              <div className="flex gap-8 flex-1">
                <div className="relative w-48 flex-shrink-0">
                  <img src={bodyImgSrc} alt="Human Body" className="w-full" />
                  <button id="t-head-button" onClick={() => setTBody('head')} className={`body-part-btn absolute top-0 left-0 w-full h-1/4 rounded-t-full transition-colors duration-300 border-2 ${tBody === 'head' ? 'active' : 'border-transparent'}`}>
                    <span className="invisible">頭</span>
                  </button>
                  <button id="t-upperbody-button" onClick={() => setTBody('upper')} className={`body-part-btn absolute top-1/4 left-0 w-full h-1/3 transition-colors duration-300 border-2 ${tBody === 'upper' ? 'active' : 'border-transparent'}`}>
                    <span className="invisible">上身</span>
                  </button>
                  <button id="t-lowerbody-button" onClick={() => setTBody('lower')} className={`body-part-btn absolute bottom-0 left-0 w-full h-2/5 rounded-b-full transition-colors duration-300 border-2 ${tBody === 'lower' ? 'active' : 'border-transparent'}`}>
                    <span className="invisible">下身</span>
                  </button>
                </div>
                <div className="flex-1">
                  <div id="t-head-trauma-options" className={`${tBody === 'head' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">psychology</span>
                        <span>頭部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['頭部鈍傷','頭部穿刺傷','頭部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:head:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:head:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">face</span>
                        <span>顏面部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['顏面部鈍傷','顏面部穿刺傷','顏面部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:face:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:face:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">visibility</span>
                        <span>眼睛</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['眼睛鈍傷','眼睛穿刺傷','眼睛撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:eye:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:eye:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">face_retouching_natural</span>
                        <span>鼻子</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['鼻子鈍傷','鼻子穿刺傷','鼻子撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:nose:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:nose:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">hearing</span>
                        <span>耳朵</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['耳朵鈍傷','耳朵穿刺傷','耳朵撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:ear:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:ear:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">accessibility_new</span>
                        <span>頸部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['頸部鈍傷','頸部穿刺傷','頸部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:neck:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:neck:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div id="t-upperbody-trauma-options" className={`${tBody === 'upper' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">favorite</span>
                        <span>胸部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['胸部鈍傷','胸部穿刺傷','胸部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:chest:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:chest:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">emergency</span>
                        <span>腹部(含骨盆)</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['腹部鈍傷','腹部穿刺傷','腹部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:abdomen:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:abdomen:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">back_hand</span>
                        <span>上肢</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['上肢鈍傷','上肢穿刺傷','上肢撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:upperlimb:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:upperlimb:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">airline_seat_recline_normal</span>
                        <span>腰背部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['腰背部鈍傷','腰背部穿刺傷','腰背部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:back:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:back:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div id="t-lowerbody-trauma-options" className={`${tBody === 'lower' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">wc</span>
                        <span>會陰部及生殖器官</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['會陰部鈍傷','會陰部穿刺傷','會陰部撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:perineum:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:perineum:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">directions_walk</span>
                        <span>下肢</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['下肢鈍傷','下肢穿刺傷','下肢撕裂傷、擦傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:lowerlimb:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:lowerlimb:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items_center gap-2">
                        <span className="material-symbols-outlined text-primary/80">local_fire_department</span>
                        <span>皮膚</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['燒燙傷'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:skin:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:skin:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">report</span>
                        <span>一般和其他傷害</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['確定或疑似性侵害','家庭暴力'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`t:other:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`t:other:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-primary/5 p-4 rounded-lg border border-primary/20">
                  <h5 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">emergency</span>
                    <span>常見外傷</span>
                  </h5>
                  <div className="grid grid-cols-6 gap-2">
                    {[{
                      icon: 'local_fire_department',
                      lines: ['皮膚','燒燙傷'],
                      key: '皮膚-燒燙傷'
                    },{
                      icon: 'face',
                      lines: ['顏面部','撕裂傷'],
                      key: '顏面部-撕裂傷'
                    },{
                      icon: 'back_hand',
                      lines: ['上肢','撕裂傷'],
                      key: '上肢-撕裂傷'
                    },{
                      icon: 'directions_walk',
                      lines: ['下肢','撕裂傷'],
                      key: '下肢-撕裂傷'
                    },{
                      icon: 'directions_run',
                      lines: ['下肢','鈍傷'],
                      key: '下肢-鈍傷'
                    },{
                      icon: 'airline_seat_recline_normal',
                      lines: ['腰背部','撕裂傷'],
                      key: '腰背部-撕裂傷'
                    }].map(item => (
                      <button key={item.key} onClick={() => toggleSelect(`t:common:${item.key}`)} className={`symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors ${selectedSymptoms.has(`t:common:${item.key}`) ? 'selected' : ''}`}>
                        <span className="material-symbols-outlined text-lg">{item.icon}</span>
                        <span className="text-center leading-tight">{item.lines[0]}<br/>{item.lines[1]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab-content="a" className={`symptom-panel flex-1 flex-col min-h-[450px] ${activeTab === 'a' ? 'flex' : 'hidden'}`}>
            <div className="flex-1 flex flex-col">
              <h4 className="font-semibold text-lg mb-3">分類</h4>
              <div className="flex gap-8 flex-1">
                <div className="relative w-48 flex-shrink-0">
                  <img src={bodyImgSrc} alt="Human Body" className="w-full" />
                  <button id="a-head-button" onClick={() => setABody('head')} className={`body-part-btn absolute top-0 left-0 w-full h-1/4 rounded-t-full transition-colors duration-300 border-2 ${aBody === 'head' ? 'active' : 'border-transparent'}`}>
                    <span className="invisible">頭</span>
                  </button>
                  <button id="a-upperbody-button" onClick={() => setABody('upper')} className={`body-part-btn absolute top-1/4 left-0 w-full h-1/3 transition-colors duration-300 border-2 ${aBody === 'upper' ? 'active' : 'border-transparent'}`}>
                    <span className="invisible">上身</span>
                  </button>
                  <button id="a-lowerbody-button" onClick={() => setABody('lower')} className={`body-part-btn absolute bottom-0 left-0 w-full h-2/5 rounded-b-full transition-colors duration-300 border-2 ${aBody === 'lower' ? 'active' : 'border-transparent'}`}>
                    <span className="invisible">下身</span>
                  </button>
                </div>
                <div className="flex-1">
                  <div id="a-head-options" className={`${aBody === 'head' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">neurology</span>
                        <span>神經系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => toggleSelect('a:neuro:中風症狀')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:中風症狀') ? 'selected' : ''}`}>中風症狀（突發性口齒不清／單側肢體感覺異常／突發性視覺異常）</button>
                        <button onClick={() => toggleSelect('a:neuro:意識改變')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:意識改變') ? 'selected' : ''}`}>意識程度改變</button>
                        <button onClick={() => toggleSelect('a:neuro:抽搐')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:抽搐') ? 'selected' : ''}`}>抽搐</button>
                        <button onClick={() => toggleSelect('a:neuro:步態不穩')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:步態不穩') ? 'selected' : ''}`}>步態不穩/運動失調</button>
                        <button onClick={() => toggleSelect('a:neuro:混亂')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:混亂') ? 'selected' : ''}`}>混亂</button>
                        <button onClick={() => toggleSelect('a:neuro:頭暈')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:頭暈') ? 'selected' : ''}`}>眩暈/頭暈</button>
                        <button onClick={() => toggleSelect('a:neuro:肢體無力')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:肢體無力') ? 'selected' : ''}`}>肢體無力</button>
                        <button onClick={() => toggleSelect('a:neuro:感覺異常')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:感覺異常') ? 'selected' : ''}`}>知覺喪失/感覺異常</button>
                        <button onClick={() => toggleSelect('a:neuro:震顫')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:震顫') ? 'selected' : ''}`}>震顫</button>
                        <button onClick={() => toggleSelect('a:neuro:頭痛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:neuro:頭痛') ? 'selected' : ''}`}>頭痛</button>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">visibility</span>
                        <span>眼科</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => toggleSelect('a:eye:化學物質暴露眼睛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:化學物質暴露眼睛') ? 'selected' : ''}`}>化學物質暴露眼睛</button>
                        <button onClick={() => toggleSelect('a:eye:畏光光傷害')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:畏光光傷害') ? 'selected' : ''}`}>畏光／光傷害</button>
                        <button onClick={() => toggleSelect('a:eye:眼眶腫脹')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:眼眶腫脹') ? 'selected' : ''}`}>眼眶腫脹</button>
                        <button onClick={() => toggleSelect('a:eye:眼睛內異物')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:眼睛內異物') ? 'selected' : ''}`}>眼睛內異物</button>
                        <button onClick={() => toggleSelect('a:eye:眼睛分泌物')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:眼睛分泌物') ? 'selected' : ''}`}>眼睛分泌物</button>
                        <button onClick={() => toggleSelect('a:eye:眼睛疼痛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:眼睛疼痛') ? 'selected' : ''}`}>眼睛疼痛</button>
                        <button onClick={() => toggleSelect('a:eye:眼睛紅癢')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:眼睛紅癢') ? 'selected' : ''}`}>眼睛紅／癢</button>
                        <button onClick={() => toggleSelect('a:eye:視覺障礙')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:eye:視覺障礙') ? 'selected' : ''}`}>視覺障礙</button>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">air</span>
                        <span>呼吸系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => toggleSelect('a:resp:呼吸停止')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:呼吸停止') ? 'selected' : ''}`}>呼吸停止</button>
                        <button onClick={() => toggleSelect('a:resp:呼吸短促')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:呼吸短促') ? 'selected' : ''}`}>呼吸短促</button>
                        <button onClick={() => toggleSelect('a:resp:呼吸道內異物')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:呼吸道內異物') ? 'selected' : ''}`}>呼吸道內異物</button>
                        <button onClick={() => toggleSelect('a:resp:咳嗽')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:咳嗽') ? 'selected' : ''}`}>咳嗽</button>
                        <button onClick={() => toggleSelect('a:resp:咳血')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:咳血') ? 'selected' : ''}`}>咳血</button>
                        <button onClick={() => toggleSelect('a:resp:換氣過度')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:換氣過度') ? 'selected' : ''}`}>換氣過度</button>
                        <button onClick={() => toggleSelect('a:resp:過敏反應')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:resp:過敏反應') ? 'selected' : ''}`}>過敏反應</button>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">hearing</span>
                        <span>耳鼻喉系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => toggleSelect('a:ent:上呼吸道感染症狀')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:上呼吸道感染症狀') ? 'selected' : ''}`}>上呼吸道感染相關症狀（鼻塞、流鼻水、咳嗽、喉嚨痛）</button>
                        <button onClick={() => toggleSelect('a:ent:吞嚥困難')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:吞嚥困難') ? 'selected' : ''}`}>吞嚥困難</button>
                        <button onClick={() => toggleSelect('a:ent:喉嚨痛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:喉嚨痛') ? 'selected' : ''}`}>喉嚨痛</button>
                        <button onClick={() => toggleSelect('a:ent:流鼻血')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:流鼻血') ? 'selected' : ''}`}>流鼻血</button>
                        <button onClick={() => toggleSelect('a:ent:牙齒牙齦問題')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:牙齒牙齦問題') ? 'selected' : ''}`}>牙齒／牙齦問題</button>
                        <button onClick={() => toggleSelect('a:ent:耳內異物')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:耳內異物') ? 'selected' : ''}`}>耳內異物</button>
                        <button onClick={() => toggleSelect('a:ent:耳朵分泌物')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:耳朵分泌物') ? 'selected' : ''}`}>耳朵分泌物</button>
                        <button onClick={() => toggleSelect('a:ent:耳朵疼痛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:耳朵疼痛') ? 'selected' : ''}`}>耳朵疼痛</button>
                        <button onClick={() => toggleSelect('a:ent:耳鳴')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:耳鳴') ? 'selected' : ''}`}>耳鳴</button>
                        <button onClick={() => toggleSelect('a:ent:聽力改變')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:聽力改變') ? 'selected' : ''}`}>聽力改變</button>
                        <button onClick={() => toggleSelect('a:ent:鼻塞')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:鼻塞') ? 'selected' : ''}`}>過敏或非特定因素引起的鼻塞</button>
                        <button onClick={() => toggleSelect('a:ent:頸部腫脹疼痛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:頸部腫脹疼痛') ? 'selected' : ''}`}>頸部腫脹／疼痛</button>
                        <button onClick={() => toggleSelect('a:ent:顏面疼痛')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:顏面疼痛') ? 'selected' : ''}`}>顏面疼痛（無外傷／無牙齒問題）</button>
                        <button onClick={() => toggleSelect('a:ent:鼻內異物')} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has('a:ent:鼻內異物') ? 'selected' : ''}`}>鼻內異物</button>
                      </div>
                    </div>
                  </div>
                  <div id="a-upperbody-options" className={`${aBody === 'upper' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">cardiology</span>
                        <span>心臟血管系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['全身性水腫','全身虛弱/無力','冰冷無脈搏的肢體','單側肢體紅熱','心悸/不規則心跳','心跳停止','暈厥','肢體水腫','胸痛/胸悶','高血壓急症'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:cardio:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:cardio:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">psychology</span>
                        <span>心理健康</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['失眠','幻覺／妄想','怪異行為','憂鬱／自殺','暴力行為／自傷／攻擊他人','焦慮／激動','社會／社交問題'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:mental:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:mental:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">coronavirus</span>
                        <span>腸胃系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['便秘','厭食','吐血','吞食異物','噁心/嘔吐','打嗝','直腸內異物','直腸會陰疼痛','腹瀉','腹痛','腹部腫塊/腹脹','血便/黑便','黃疸','鼠蹊部疼痛/腫塊'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:gi:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:gi:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">emergency_home</span>
                        <span>骨骼系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['上肢疼痛','背痛','關節腫脹'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:bone:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:bone:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div id="a-lowerbody-options" className={`${aBody === 'lower' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">urology</span>
                        <span>泌尿系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['多尿','少尿','尿滯留','泌尿道感染相關症狀（頻尿、解尿疼痛）','生殖器官分泌物／病變','腰痛','血尿','陰囊疼痛／腫脹','陰莖腫脹','鼠蹊部疼痛／腫塊'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:uro:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:uro:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">female</span>
                        <span>婦產科</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['懷孕問題（大於20週／小於20週）','月經問題','產後出血','確定或疑似性侵害','陰唇腫脹','陰道內異物','陰道出血','陰道分泌物','陰道疼痛／搔癢'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:obgy:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:obgy:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">emergency_home</span>
                        <span>骨骼系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['下肢疼痛','關節腫脹'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:bone:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:bone:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">dermatology</span>
                        <span>皮膚系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['乳房紅腫','局部紅腫','搔癢','疑似傳染性皮膚病','發紺','皮膚內異物','紅疹','腫塊／結節','自發性瘀斑','血液體液曝露'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:derm:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:derm:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">clinical_notes</span>
                        <span>一般與其他</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['全身倦怠','發燒','體重減輕','不明原因疼痛','其他未分類症狀'].map(label => (
                          <button key={label} onClick={() => toggleSelect(`a:general:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${selectedSymptoms.has(`a:general:${label}`) ? 'selected' : ''}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-primary/5 p-4 rounded-lg border border-primary/20">
                  <h5 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">emergency</span>
                    <span>常見非外傷</span>
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {['呼吸困難','發燒','腹痛','頭暈','頭痛','意識改變','嘔吐','咳嗽','腰痛'].map(label => (
                      <button key={label} onClick={() => toggleSelect(`a:common:${label}`)} className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors ${selectedSymptoms.has(`a:common:${label}`) ? 'selected' : ''}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab-content="e" className={`symptom-panel flex-1 flex-col min-h-[450px] ${activeTab === 'e' ? 'flex' : 'hidden'}`}>
            <h4 className="font-semibold text-lg mb-3">分類</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: 'bug_report', label: '昆蟲螫傷' },
                { icon: 'scuba_diving', label: '海洋生物螫傷' },
                { icon: 'pets', label: '動物咬傷' },
                { icon: 'coronavirus', label: '蛇咬傷' },
                { icon: 'science', label: '化學物質暴露' },
                { icon: 'thermostat', label: '中暑/高體溫症' },
                { icon: 'ac_unit', label: '低體溫症' },
                { icon: 'gas_meter', label: '有毒氣體吸入/暴露' },
                { icon: 'pool', label: '溺水' },
                { icon: 'severe_cold', label: '凍傷' },
                { icon: 'bolt', label: '電擊傷害' },
              ].map(item => (
                <button key={item.label} onClick={() => toggleSelect(`e:${item.label}`)} className={`symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full ${selectedSymptoms.has(`e:${item.label}`) ? 'selected' : ''}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="symptom-text">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SymptomSelection;
