import React, { useState, useMemo, useEffect } from 'react';

interface SymptomSelectionProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeTab: 't' | 'a';
  age?: number; // 病患年齡，用於成人(A)/兒童(P)非外傷症狀切換
}

const SymptomSelection: React.FC<SymptomSelectionProps> = ({ selectedSymptoms, setSelectedSymptoms, activeTab, age }) => {
  interface TriageRow {
    category: string;
    system_code: string;
    system_name: string;
    symptom_code: string;
    symptom_name: string;
    rule_code: string;
    judge_name: string;
    ttas_degree: string;
    nhi_degree: string;
  }

  const [triageRows, setTriageRows] = useState<TriageRow[] | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);

  const normalizeSymptomName = (name: string): string => {
    // 移除後面括號內的補充說明，無論是全形（ ）或半形 ( )
    let base = name;
    const fullIdx = base.indexOf('（');
    const asciiIdx = base.indexOf('(');
    let cut = -1;
    if (fullIdx >= 0 && asciiIdx >= 0) {
      cut = Math.min(fullIdx, asciiIdx);
    } else if (fullIdx >= 0) {
      cut = fullIdx;
    } else if (asciiIdx >= 0) {
      cut = asciiIdx;
    }
    if (cut >= 0) {
      base = base.slice(0, cut);
    }
    return base.trim();
  };

  interface CcRow {
    category: string;
    system_code: string;
    system_name: string;
    symptom_code: string;
    symptom_name: string;
    count: number;
  }

  const [ccRows, setCcRows] = useState<CcRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const res = await fetch('http://localhost/專題test/專題-react-version/api/get_triage_hierarchy.php');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: TriageRow[] = await res.json();
        if (cancelled) return;
        setTriageRows(data ?? []);
      } catch (err: any) {
        if (cancelled) return;
        setTriageError(err?.message ?? '載入 triage_hierarchy（資料庫）失敗');
      }
    };

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCcFromDb = async () => {
      try {
        const res = await fetch('http://localhost/專題test/專題-react-version/api/get_cc_with_counts.php');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: CcRow[] = await res.json();
        if (cancelled) return;
        setCcRows(data ?? []);
      } catch {
        if (cancelled) return;
        // 常見症狀資料庫查詢失敗時，維持 null，僅不顯示 header 快捷
        setCcRows(null);
      }
    };

    loadCcFromDb();

    return () => {
      cancelled = true;
    };
  }, []);

  const symptomIndex = useMemo(() => {
    if (!triageRows) return null;

    const index = new Map<string, string[]>();
    const isAdult = age !== undefined ? age >= 18 : true;

    for (const row of triageRows) {
      // 非外傷症狀依 A*/P* 與年齡切換；外傷/環境(T*/E*)不受影響
      if (row.system_code.startsWith('A') && !isAdult) continue;
      if (row.system_code.startsWith('P') && isAdult) continue;

      const key = `${row.category}|${row.system_name}`;
      let list = index.get(key);
      if (!list) {
        list = [];
        index.set(key, list);
      }
      const normalized = normalizeSymptomName(row.symptom_name);
      const hasSame = list.some(label => normalizeSymptomName(label) === normalized);
      if (!hasSame) {
        list.push(row.symptom_name);
      }
    }

    return index;
  }, [triageRows, age]);

  const getSymptoms = (category: string, systemName: string): string[] => {
    if (!symptomIndex) return [];
    const key = `${category}|${systemName}`;
    return symptomIndex.get(key) ?? [];
  };

  const commonTrauma = useMemo(() => {
    if (!ccRows) return [] as CcRow[];

    // 先依 symptom_name 合併，多筆時保留 count 較大的那一筆，避免同一症狀（例如成人/兒童版）出現兩次
    const byName = new Map<string, CcRow>();
    for (const row of ccRows) {
      if (row.category !== '外傷') continue;
      const key = normalizeSymptomName(row.symptom_name);
      const existing = byName.get(key);
      if (!existing || row.count > existing.count) {
        byName.set(key, row);
      }
    }

    return Array.from(byName.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [ccRows]);

  const commonNonTrauma = useMemo(() => {
    if (!ccRows) return [] as CcRow[];

    const byName = new Map<string, CcRow>();
    const isAdult = age !== undefined ? age >= 18 : true;

    for (const row of ccRows) {
      if (row.category !== '非外傷') continue;
      // 非外傷常見主訴依 system_code A*/P* 與年齡切換
      if (row.system_code.startsWith('A') && !isAdult) continue;
      if (row.system_code.startsWith('P') && isAdult) continue;

      const key = normalizeSymptomName(row.symptom_name);
      const existing = byName.get(key);
      if (!existing || row.count > existing.count) {
        byName.set(key, row);
      }
    }

    // 先依出現次數取前 N 名
    const limit = 8;
    const topByCount = Array.from(byName.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // 成人：為了讓版面高度比較均勻，用「字比較長的排前面」
    if (isAdult) {
      return topByCount.sort((a, b) => b.symptom_name.length - a.symptom_name.length);
    }

    // 兒童：維持依出現次數排序（最常見的在最前面）
    return topByCount;
  }, [ccRows, age]);

  const [tBody, setTBody] = useState<'head' | 'upper' | 'lower' | null>(null);
  const [aBody, setABody] = useState<'head' | 'upper' | 'lower' | null>(null);

  const bodyImgSrc = useMemo(() => {
    // Served from Vite public/ so path is stable in dev/build
    return '/人體圖.jpg';
  }, []);

  const toggleSelect = (key: string) => {
    setSelectedSymptoms(prev => {
      const cleanTarget = normalizeSymptomName(key.replace(/^[^:]+:/, '').replace(/^[^:]+:/, ''));
      const next = new Set(prev);

      // 如果已經有同名症狀，視為 toggle off：移除所有同名 key
      let removed = false;
      for (const existing of Array.from(next)) {
        const cleanExisting = normalizeSymptomName(existing.replace(/^[^:]+:/, '').replace(/^[^:]+:/, ''));
        if (cleanExisting === cleanTarget) {
          next.delete(existing);
          removed = true;
        }
      }

      // 若沒有同名症狀，則新增這個 key（toggle on）
      if (!removed) {
        next.add(key);
      }

      return next;
    });
  };

  const isSymptomSelected = (label: string) => {
    return Array.from(selectedSymptoms).some(existing => {
      const cleanExisting = normalizeSymptomName(existing.replace(/^[^:]+:/, '').replace(/^[^:]+:/, ''));
      return cleanExisting === normalizeSymptomName(label);
    });
  };

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg flex-1 flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-4 min-h-[96px]">
        <h3 className="text-2xl font-bold flex-1">選擇症狀</h3>
        <div className="flex items-center gap-3 ml-auto h-full">
          {activeTab === 't' && (
            <div className="bg-primary/5 p-2.5 rounded-lg border border-primary/20 flex items-center gap-2 max-w-[40rem]">
              <h5 className="font-semibold text-sm flex items-center gap-1 whitespace-nowrap">
                <span className="material-symbols-outlined text-primary text-base">emergency</span>
                <span>常見外傷</span>
              </h5>
              <div className="flex flex-wrap gap-2 justify-end">
                {commonTrauma.map(item => (
                  <button
                    key={item.symptom_code}
                    onClick={() => toggleSelect(`t:common:${item.symptom_name}`)}
                    className={`symptom-option-btn px-3 py-1.5 rounded-full text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors ${(selectedSymptoms.has(`t:common:${item.symptom_name}`) || isSymptomSelected(item.symptom_name)) ? 'selected' : ''}`}
                  >
                    {item.symptom_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'a' && (
            <div className="bg-primary/5 p-2.5 rounded-lg border border-primary/20 flex items-center gap-2 max-w-[40rem]">
              <h5 className="font-semibold text-sm mb-0 flex items-center gap-1 whitespace-nowrap">
                <span className="material-symbols-outlined text-primary text-base">emergency</span>
                <span>常見非外傷</span>
              </h5>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex flex-wrap gap-2 justify-end">
                  {commonNonTrauma.slice(0, 3).map(item => (
                    <button
                      key={item.symptom_code}
                      onClick={() => toggleSelect(`a:common:${item.symptom_name}`)}
                      className={`symptom-option-btn px-3 py-1.5 rounded-full text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors ${(selectedSymptoms.has(`a:common:${item.symptom_name}`) || isSymptomSelected(item.symptom_name)) ? 'selected' : ''}`}
                    >
                      {item.symptom_name}
                    </button>
                  ))}
                </div>
                {commonNonTrauma.length > 3 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {commonNonTrauma.slice(3).map(item => (
                      <button
                        key={item.symptom_code}
                        onClick={() => toggleSelect(`a:common:${item.symptom_name}`)}
                        className={`symptom-option-btn px-3 py-1.5 rounded-full text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors ${(selectedSymptoms.has(`a:common:${item.symptom_name}`) || isSymptomSelected(item.symptom_name)) ? 'selected' : ''}`}
                      >
                        {item.symptom_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {triageError && (
        <div className="mb-3 text-sm text-red-500">{triageError}</div>
      )}
      <div className="space-y-6 flex-1 flex flex-col">
        <div className="mt-4 space-y-4 flex-1 flex flex-col">
          <div data-tab-content="t" className={`symptom-panel flex-1 flex-col min-h-[450px] ${activeTab === 't' ? 'flex' : 'hidden'}`}>
            <div className="flex-1 flex flex-col">
              <h4 className="font-semibold text-lg mb-3">分類</h4>
              <div className="flex gap-8 flex-1 items-start">
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
                <div className="flex-1 flex flex-col">
                  <div id="t-head-trauma-options" className={`${tBody === 'head' ? '' : 'hidden'} space-y-6`}>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">psychology</span>
                        <span>頭部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '頭部外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:head:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:head:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">face</span>
                        <span>顏面部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '顏面部外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:face:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:face:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">visibility</span>
                        <span>眼睛</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '眼睛外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:eye:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:eye:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">face_retouching_natural</span>
                        <span>鼻子</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '鼻子外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:nose:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:nose:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">hearing</span>
                        <span>耳朵</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '耳朵外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:ear:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:ear:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">accessibility_new</span>
                        <span>頸部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '頸部外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:neck:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:neck:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
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
                        {getSymptoms('外傷', '胸部外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:chest:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:chest:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">emergency</span>
                        <span>腹部(含骨盆)</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '腹部(含骨盆)外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:abdomen:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:abdomen:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">back_hand</span>
                        <span>上肢</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '肢體外傷').filter(name => name.includes('上肢')).map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:upperlimb:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:upperlimb:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">airline_seat_recline_normal</span>
                        <span>腰背部</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '腰、背部外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:back:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:back:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
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
                        {getSymptoms('外傷', '會陰部及生殖器官外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:perineum:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:perineum:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">directions_walk</span>
                        <span>下肢</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '肢體外傷').filter(name => name.includes('下肢')).map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:lowerlimb:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:lowerlimb:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items_center gap-2">
                        <span className="material-symbols-outlined text-primary/80">local_fire_department</span>
                        <span>皮膚</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '皮膚外傷').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:skin:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:skin:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">report</span>
                        <span>一般和其他傷害</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '一般和其他傷害').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`t:other:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:other:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">eco</span>
                        <span>環境</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('外傷', '環境').map(label => {
                          const iconMap: Record<string, string> = {
                            '昆蟲螫傷': 'bug_report',
                            '海洋生物螫咬': 'scuba_diving',
                            '動物咬傷': 'pets',
                            '蛇咬傷': 'coronavirus',
                            '化學物質暴露(疑似或確定化學、輻射或危害物質暴露)': 'science',
                            '中暑/高體溫症': 'thermostat',
                            '低體溫症': 'ac_unit',
                            '有毒氣體吸入/暴露': 'gas_meter',
                            '溺水': 'pool',
                            '凍傷': 'severe_cold',
                            '電擊傷害': 'bolt',
                          };
                          const icon = iconMap[label] ?? 'eco';
                          return (
                            <button
                              key={label}
                              onClick={() => toggleSelect(`t:env:${label}`)}
                              className={`symptom-option-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`t:env:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                            >
                              <span className="material-symbols-outlined">{icon}</span>
                              <span className="symptom-text">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-tab-content="a" className={`symptom-panel flex-1 flex-col min-h-[450px] ${activeTab === 'a' ? 'flex' : 'hidden'}`}>
            <div className="flex-1 flex flex-col">
              <h4 className="font-semibold text-lg mb-3">分類</h4>
              <div className="flex gap-8 flex-1 items-start">
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
                        {getSymptoms('非外傷', '神經系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:neuro:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:neuro:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">visibility</span>
                        <span>眼科</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '眼科').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:eye:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:eye:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">air</span>
                        <span>呼吸系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '呼吸系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:resp:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:resp:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">hearing</span>
                        <span>耳鼻喉系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '耳鼻喉系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:ent:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:ent:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
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
                        {getSymptoms('非外傷', '心臟血管系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:cardio:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:cardio:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">psychology</span>
                        <span>心理健康</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '心理健康').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:mental:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:mental:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">coronavirus</span>
                        <span>腸胃系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '腸胃系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:gi:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:gi:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">emergency_home</span>
                        <span>骨骼系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '骨骼系統').filter(name => name.includes('上肢') || name.includes('背') || name.includes('關節')).map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:bone:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:bone:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
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
                        {getSymptoms('非外傷', '泌尿系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:uro:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:uro:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">female</span>
                        <span>婦產科</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '婦產科').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:obgy:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:obgy:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">emergency_home</span>
                        <span>骨骼系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '骨骼系統').filter(name => name.includes('下肢') || name.includes('關節')).map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:bone:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:bone:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">dermatology</span>
                        <span>皮膚系統</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '皮膚系統').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:derm:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:derm:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/80">clinical_notes</span>
                        <span>一般與其他</span>
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getSymptoms('非外傷', '一般和其他').map(label => (
                          <button
                            key={label}
                            onClick={() => toggleSelect(`a:general:${label}`)}
                            className={`symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${(selectedSymptoms.has(`a:general:${label}`) || isSymptomSelected(label)) ? 'selected' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SymptomSelection;
