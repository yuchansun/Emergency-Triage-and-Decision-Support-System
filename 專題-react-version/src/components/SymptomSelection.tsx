import React, { useState, useMemo, useEffect } from 'react';

interface SymptomSelectionProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeTab: 't' | 'a';
  age?: number;
}

const SymptomSelection: React.FC<SymptomSelectionProps> = ({ selectedSymptoms, setSelectedSymptoms, activeTab, age }) => {
  // --- 1. Interface 定義 ---
  interface TriageRow {
    category: string;
    system_code: string;
    system_name: string;
    symptom_code: string;
    symptom_name: string;
  }

  interface CcRow {
    category: string;
    system_code: string;
    system_name: string;
    symptom_code: string;
    symptom_name: string;
    count: number;
  }

  // --- 2. State ---
  const [triageRows, setTriageRows] = useState<TriageRow[] | null>(null);
  const [ccRows, setCcRows] = useState<CcRow[] | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  
  // 改為 Set 支援多選部位
  const [activeBodies, setActiveBodies] = useState<Set<'head' | 'upper' | 'lower'>>(new Set());
  const [frequencyData, setFrequencyData] = useState<any[]>([]);

  // --- 3. 工具函式 ---
  const normalizeSymptomName = (name: string): string => {
    let base = name;
    const fullIdx = base.indexOf('（');
    const asciiIdx = base.indexOf('(');
    let cut = -1;
    if (fullIdx >= 0 && asciiIdx >= 0) cut = Math.min(fullIdx, asciiIdx);
    else if (fullIdx >= 0) cut = fullIdx;
    else if (asciiIdx >= 0) cut = asciiIdx;
    if (cut >= 0) base = base.slice(0, cut);
    return base.trim();
  };

  // --- 4. 資料載入 ---
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const res = await fetch("http://localhost:8000/triage_hierarchy");
        const data = await res.json();
        setTriageRows(data ?? []);
      } catch (err: any) {
        setTriageError(err?.message ?? '載入失敗');
      }
    };
    loadFromDb();
  }, []);

  useEffect(() => {
    const loadCcFromDb = async () => {
      try {
        const res = await fetch("http://localhost:8000/cc_with_counts");
        const data = await res.json();
        setCcRows(data ?? []);
      } catch {
        setCcRows(null);
      }
    };
    loadCcFromDb();
  }, []);

  // --- 5. 邏輯運算 (常見症狀根據 Count 排序) ---
  const commonTrauma = useMemo(() => {
    if (!ccRows) return [];
    const byName = new Map<string, CcRow>();
    for (const row of ccRows) {
      if (row.category !== '外傷') continue;
      const key = normalizeSymptomName(row.symptom_name);
      const existing = byName.get(key);
      if (!existing || row.count > existing.count) byName.set(key, row);
    }
    return Array.from(byName.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [ccRows]);

  const commonNonTrauma = useMemo(() => {
    if (!ccRows) return [];
    const byName = new Map<string, CcRow>();
    const isAdult = age !== undefined ? age >= 18 : true;
    for (const row of ccRows) {
      if (row.category !== '非外傷') continue;
      if (row.system_code.startsWith('A') && !isAdult) continue;
      if (row.system_code.startsWith('P') && isAdult) continue;
      const key = normalizeSymptomName(row.symptom_name);
      const existing = byName.get(key);
      if (!existing || row.count > existing.count) byName.set(key, row);
    }
    return Array.from(byName.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [ccRows, age]);

// --- 6. 部位多選與系統過濾邏輯 ---
const handleBodyPartClick = async (part: 'head' | 'upper' | 'lower') => {
  const nextBodies = new Set(activeBodies);
  if (nextBodies.has(part)) nextBodies.delete(part);
  else nextBodies.add(part);
  
  setActiveBodies(nextBodies);

  if (nextBodies.size === 0) {
    setFrequencyData([]);
    return;
  }

  try {
    const requests = Array.from(nextBodies).map(p => 
      fetch(`http://localhost:8000/api/symptoms-by-frequency/${p}`).then(res => res.json())
    );
    const results = await Promise.all(requests);
    
    let combined: any[] = [];
    results.forEach(res => {
      if (res.status === 'success') combined = [...combined, ...res.data];
    });

    // ✅ P + T 系統對應（不動原本，只補 T）
    const headSystems = [
      'P04', 'P08', 'P07', 'P01',
      'T02','T03','T04','T05','T06','T07'
    ];

    const upperSystems = [
      'P02', 'P03', 'P11', 'P12',
      'T08'
    ];

    const lowerSystems = [
      'P05','P06','P09','P10',
      'T01','T09','T10','T11','T12','T13','T14'
    ];

    const filteredData = combined.filter(group => {
      const id = group.system_id;

      // ✅ 加這段：外傷 / 非外傷 分流（核心）
      if (activeTab === 't' && !id.startsWith('T')) return false;
      if (activeTab === 'a' && !id.startsWith('P')) return false;

      const isHead = nextBodies.has('head') && headSystems.includes(id);
      const isUpper = nextBodies.has('upper') && upperSystems.includes(id);
      const isLower = nextBodies.has('lower') && lowerSystems.includes(id);

      return isHead || isUpper || isLower;
    });

    // 去重 + 排序
    const uniqueMap = new Map();
    filteredData.forEach(item => {
      item.symptoms.sort((a: any, b: any) => b.count - a.count);
      uniqueMap.set(item.system_id, item);
    });

    setFrequencyData(Array.from(uniqueMap.values()));

  } catch (err) {
    console.error("Fetch error:", err);
  }
};

  // --- 7. UI 圖示映射 ---
  const iconMap: { [key: string]: string } = {
  // --- Head (上) ---
  "P01": "air",           // 呼吸系統
  "P04": "psychology",    // 神經系統
  "P07": "hearing",       // 耳鼻喉系統
  "P08": "visibility",    // 眼科

  // --- Upper (中) ---
  "P02": "monitor_heart", // 心臟血管系統
  "P03": "coronavirus",       // 腸胃系統
  "P11": "psychiatry",    // 心理健康
  "P12": "medication",    // 物質誤用

  // --- Lower (下 / 其他) ---
  "P05": "skeleton",      // 骨骼系統 (原本是 P09, 依妳要求改為 P05)
  "P06": "tibia",         // 泌尿系統 (原本是 P06)
  "P09": "vaccines",      // 皮膚系統 (原本是 P11, 依妳要求改為 P09)
  "P10": "female",        // 婦產科 (原本是 P10)
  
  // 備用
  "P13": "clinical_notes", // 其他
  // --- Trauma 外傷 ---
"T01": "emergency",
"T02": "psychology",
"T03": "face",
"T04": "visibility",
"T05": "air",
"T06": "hearing",
"T07": "accessibility_new",
"T08": "monitor_heart",
"T09": "healing",
"T10": "self_improvement",
"T11": "pregnant_woman",
"T12": "sports_handball",
"T13": "dermatology",
"T14": "medical_services",
};

  const toggleSelect = (key: string) => {
    setSelectedSymptoms(prev => {
      const cleanTarget = normalizeSymptomName(key.replace(/^[^:]+:/, '').replace(/^[^:]+:/, ''));
      const next = new Set(prev);
      let removed = false;
      for (const existing of Array.from(next)) {
        if (normalizeSymptomName(existing.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '')) === cleanTarget) {
          next.delete(existing);
          removed = true;
        }
      }
      if (!removed) next.add(key);
      return next;
    });
  };

  const isSymptomSelected = (label: string) => {
    return Array.from(selectedSymptoms).some(existing => 
      normalizeSymptomName(existing.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '')) === normalizeSymptomName(label)
    );
  };

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg flex-1 flex flex-col">
      {/* 頂部：常見症狀區 (已排序) */}
      <div className="flex items-center justify-between gap-4 mb-4 min-h-[96px]">
        <h3 className="text-2xl font-bold flex-1">選擇症狀</h3>
        <div className="flex items-center gap-3 ml-auto">
          <div className="bg-primary/5 p-2.5 rounded-lg border border-primary/20 flex items-center gap-2">
            <h5 className="font-semibold text-sm whitespace-nowrap">
              {activeTab === 't' ? '常見外傷' : '常見非外傷'}
            </h5>
            <div className="flex flex-wrap gap-2">
              {(activeTab === 't' ? commonTrauma : commonNonTrauma).map(item => (
                <button 
                  key={item.symptom_code} 
                  onClick={() => toggleSelect(`${activeTab}:common:${item.symptom_name}`)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    isSymptomSelected(item.symptom_name) ? 'bg-primary text-white' : 'bg-white border-primary/30 text-primary hover:bg-primary/5'
                  }`}
                >
                  {item.symptom_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {triageError && <div className="text-red-500 text-xs mb-2">{triageError}</div>}

      {/* 主要互動區 */}
      <div className="flex flex-1 gap-8 mt-4 min-h-0">
        {/* 左側：人體圖 (支援多選) */}
        <div className="relative w-[280px] h-[520px] bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
          <img src="/人體圖.jpg" className="w-full h-full object-contain" alt="人體圖" />
          <button onClick={() => handleBodyPartClick('head')} 
            className={`absolute top-[4%] left-[32%] w-[36%] h-[16%] rounded-full border-2 transition-all ${activeBodies.has('head') ? 'border-primary bg-primary/20 shadow-lg' : 'border-transparent hover:border-primary/40'}`} />
          <button onClick={() => handleBodyPartClick('upper')} 
            className={`absolute top-[20%] left-[22%] w-[56%] h-[32%] rounded-2xl border-2 transition-all ${activeBodies.has('upper') ? 'border-primary bg-primary/20 shadow-lg' : 'border-transparent hover:border-primary/40'}`} />
          <button onClick={() => handleBodyPartClick('lower')} 
            className={`absolute top-[53%] left-[20%] w-[60%] h-[40%] rounded-2xl border-2 transition-all ${activeBodies.has('lower') ? 'border-primary bg-primary/20 shadow-lg' : 'border-transparent hover:border-primary/40'}`} />
        </div>

        {/* 右側：熱門推薦 (根據部位過濾並排序) */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {frequencyData.length > 0 ? (
            <div className="space-y-6">
              {frequencyData.map((group) => (
                <div key={group.system_id} className="animate-in fade-in slide-in-from-right-4">
                  <h5 className="font-semibold text-base flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary/80">
                      {iconMap[group.system_id] || "medical_services"}
                    </span>
                    <span>{group.system_name}</span>
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {group.symptoms.map((sym: any) => (
                      <button
                        key={sym.code}
                        onClick={() => toggleSelect(`${activeTab}:${group.system_name}:${sym.name}`)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                          isSymptomSelected(sym.name) 
                          ? 'bg-primary text-white border-primary shadow-md' 
                          : 'bg-primary/5 text-primary border-transparent hover:bg-primary/10'
                        }`}
                      >
                        {sym.name}
                        <span className="text-[10px] ml-1 opacity-60">({sym.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-3xl">
              <span className="material-symbols-outlined text-5xl mb-2 opacity-20">touch_app</span>
              <p className="text-sm">請點擊左側部位查看推薦（可多選）</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymptomSelection;