import React, { useState, useMemo, useEffect, useRef } from 'react';

interface ChiefComplaintProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  activeTab: 't' | 'a';
  setActiveTab: React.Dispatch<React.SetStateAction<'t' | 'a'>>;
  onWorstDegreeChange: (degree: number | null) => void;
}

const ChiefComplaint: React.FC<ChiefComplaintProps> = ({ selectedSymptoms, setSelectedSymptoms, inputText, setInputText, activeTab, setActiveTab, onWorstDegreeChange }) => {
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
  const recognitionRef = useRef<any | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCsv = async () => {
      try {
        const res = await fetch('/triage_hierarchy.csv');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (cancelled) return;

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setTriageRows([]);
          return;
        }

        const rows: TriageRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length < 9) continue;
          const [category, system_code, system_name, symptom_code, symptom_name, rule_code, judge_name, ttas_degree, nhi_degree] = parts;
          rows.push({
            category,
            system_code,
            system_name,
            symptom_code,
            symptom_name,
            rule_code,
            judge_name,
            ttas_degree,
            nhi_degree,
          });
        }

        setTriageRows(rows);
      } catch (err: any) {
        if (cancelled) return;
        setTriageError(err?.message ?? '載入 triage_hierarchy.csv 失敗');
      }
    };

    loadCsv();

    return () => {
      cancelled = true;
    };
  }, []);

  const [recommendedSymptoms, setRecommendedSymptoms] = useState<string[]>([]);

  // 從 triage_hierarchy.csv 建立完整症狀清單與對應 TTAS 級數
  const symptomDatabase = useMemo(() => {
    if (!triageRows) return [];
    const names: string[] = [];
    for (const row of triageRows) {
      if (!names.includes(row.symptom_name)) {
        names.push(row.symptom_name);
      }
    }
    return names;
  }, [triageRows]);

  const symptomDegreeIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (!triageRows) return map;
    for (const row of triageRows) {
      const degree = parseInt(row.ttas_degree, 10);
      if (!Number.isFinite(degree)) continue;
      const existing = map.get(row.symptom_name);
      if (existing === undefined || degree < existing) {
        map.set(row.symptom_name, degree);
      }
    }
    return map;
  }, [triageRows]);

  useEffect(() => {
    if (inputText.trim()) {
      searchSymptoms(inputText);
    }
  }, [activeTab]);

  // 每個症狀出現過的類別（外傷/非外傷）
  const symptomCategoryIndex = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!triageRows) return map;
    for (const row of triageRows) {
      const set = map.get(row.symptom_name) ?? new Set<string>();
      set.add(row.category);
      map.set(row.symptom_name, set);
    }
    return map;
  }, [triageRows]);

  // 每個症狀對應的所有 TTAS 判斷依據 (級數 + 說明)
  const symptomCriteriaIndex = useMemo(() => {
    const map = new Map<string, { degree: number; judge: string }[]>();
    if (!triageRows) return map;
    for (const row of triageRows) {
      const degree = parseInt(row.ttas_degree, 10);
      if (!Number.isFinite(degree) || !row.judge_name) continue;
      const list = map.get(row.symptom_name) ?? [];
      if (!list.some(item => item.degree === degree && item.judge === row.judge_name)) {
        list.push({ degree, judge: row.judge_name });
      }
      map.set(row.symptom_name, list);
    }
    // 依級數排序，低級數(較嚴重)在前
    for (const list of map.values()) {
      list.sort((a, b) => a.degree - b.degree);
    }
    return map;
  }, [triageRows]);

  // 搜尋推薦症狀（基於輸入框中的所有關鍵字）
  const searchSymptoms = (text: string, selectedOverride?: Set<string>) => {
    if (!symptomDatabase.length) {
      setRecommendedSymptoms([]);
      return;
    }
    if (text.length < 1) {
      setRecommendedSymptoms([]);
      return;
    }
    
    // 提取所有可能的關鍵字（包括中文字符、英文單詞）
    const allKeywords = text
      .replace(/[\s\n\r\t,，。！？；：「」『』（）()\[\]{}]/g, ' ') // 替換標點符號為空格
      .split(/\s+/) // 按空格分割
      .filter(keyword => keyword.length > 0) // 移除空字符串
      .flatMap(keyword => {
        // 對於每個關鍵字，也提取單個中文字符
        const chars = keyword.split('').filter(char => /[\u4e00-\u9fff]/.test(char));
        return [keyword, ...chars];
      })
      .filter((keyword, index, array) => array.indexOf(keyword) === index && keyword.length > 0); // 去重
    
    if (allKeywords.length === 0) {
      setRecommendedSymptoms([]);
      return;
    }
    
    const selectedSet = selectedOverride ?? selectedSymptoms;

    const currentCategory = activeTab === 't' ? '外傷' : '非外傷';

    const matches = symptomDatabase.filter(symptom => {
      // 先用類別過濾：只推薦屬於目前 T/A 類別的症狀
      const cats = symptomCategoryIndex.get(symptom);
      if (!cats || !cats.has(currentCategory)) return false;
      // 檢查是否已經選中（任何前綴）
      const isAlreadySelected = Array.from(selectedSet).some(selected => {
        const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
        return cleanSelected === symptom;
      });
      
      if (isAlreadySelected) return false;
      
      // 檢查是否包含任一關鍵字（OR邏輯，而非AND）
      return allKeywords.some(keyword => 
        symptom.toLowerCase().includes(keyword.toLowerCase())
      );
    })
    .sort((a, b) => {
      // 按匹配的關鍵字數量排序（匹配更多關鍵字的排在前面）
      const aMatches = allKeywords.filter(keyword => 
        a.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      const bMatches = allKeywords.filter(keyword => 
        b.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      return bMatches - aMatches;
    })
    .slice(0, 10); // 增加到10個推薦
    
    setRecommendedSymptoms(matches);
  };

  // 處理輸入變化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    // 即時搜尋，無論是新輸入還是繼續輸入
    searchSymptoms(text);
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Enter 鍵不清空輸入，保持搜尋狀態
      searchSymptoms(inputText);
    }
  };

  const handleVoiceInputClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('此瀏覽器不支援語音輸入 (SpeechRecognition)。請改用 Chrome 等支援的瀏覽器。');
      return;
    }

    // 若已在聽，則停止
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      setInputText(prev => {
        const base = prev || '';
        const nextText = base ? base + (base.endsWith('\n') ? '' : '\n') + transcript : transcript;
        searchSymptoms(nextText);
        return nextText;
      });
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      // 有些瀏覽器若重複呼叫 start 會丟錯誤，這裡忽略即可
    }
  };

  // 添加推薦症狀
  const addRecommendedSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => {
      // 如果這個症狀文字已經在任何 key 裡，就不再新增重複的
      const alreadyHas = Array.from(prev).some(selected => {
        const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
        return cleanSelected === symptom;
      });
      if (alreadyHas) return prev;

      const next = new Set(prev);
      next.add(`manual:${symptom}`);

      // 立刻用更新後的 selected set 重新計算推薦清單
      if (inputText.trim()) {
        searchSymptoms(inputText, next);
      }

      return next;
    });
  };

  // 移除症狀
  const removeSymptom = (symptomDisplay: string) => {
    setSelectedSymptoms(prev => {
      const next = new Set(prev);
      // 依顯示文字（去掉前綴後的症狀名稱）移除所有對應 key
      for (const key of Array.from(prev)) {
        const cleanKey = key.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
        if (cleanKey === symptomDisplay) {
          next.delete(key);
        }
      }

      // 用更新後的 selected set 重新計算推薦清單（剛移除的症狀可能重新出現）
      if (inputText.trim()) {
        searchSymptoms(inputText, next);
      }

      return next;
    });
  };

  // 將選中的症狀轉換為可讀的標籤與其判斷規則
  const symptomTags = useMemo(() => {
    const map = new Map<string, { display: string; degrees: number | undefined; criteria: { degree: number; judge: string }[] }>();

    for (const key of selectedSymptoms) {
      // 移除前綴（如 't:', 'emerg:', 'manual:' 等）
      const cleanKey = key.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
      const existing = map.get(cleanKey);
      const degree = symptomDegreeIndex.get(cleanKey);
      const criteria = symptomCriteriaIndex.get(cleanKey) ?? [];

      if (!existing) {
        map.set(cleanKey, { display: cleanKey, degrees: degree, criteria });
      }
    }

    return Array.from(map.values());
  }, [selectedSymptoms, symptomDegreeIndex, symptomCriteriaIndex]);

  const [selectedRules, setSelectedRules] = useState<Record<string, { degree: number; judge: string }>>({});

  const worstSelectedDegree = useMemo(() => {
    const degrees = Object.values(selectedRules).map(r => r.degree);
    if (degrees.length === 0) return null;
    return Math.min(...degrees);
  }, [selectedRules]);

  useEffect(() => {
    onWorstDegreeChange(worstSelectedDegree);
  }, [worstSelectedDegree, onWorstDegreeChange]);

  const getRuleColors = (degree: number) => {
    switch (degree) {
      case 1:
        return { border: 'border-red-500', bg: 'bg-red-500/10 hover:bg-red-500/20', text: 'text-red-500' };
      case 2:
        return { border: 'border-orange-500', bg: 'bg-orange-500/10 hover:bg-orange-500/20', text: 'text-orange-500' };
      case 3:
        return { border: 'border-yellow-500', bg: 'bg-yellow-500/10 hover:bg-yellow-500/20', text: 'text-yellow-500' };
      case 4:
        return { border: 'border-green-500', bg: 'bg-green-500/10 hover:bg-green-500/20', text: 'text-green-500' };
      case 5:
      default:
        return { border: 'border-blue-500', bg: 'bg-blue-500/10 hover:bg-blue-500/20', text: 'text-blue-500' };
    }
  };

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold flex items-center gap-2">主訴</h3>
          <div className="inline-flex gap-3 bg-background-light dark:bg-background-dark/60 px-2 py-2 rounded-2xl border border-primary/30">
            <button
              type="button"
              onClick={() => setActiveTab('t')}
              className={`px-6 py-2.5 rounded-xl text-base font-semibold transition-colors ${
                activeTab === 't'
                  ? 'bg-primary text-white'
                  : 'bg-transparent text-primary hover:bg-primary/10'
              }`}
            >
              T 外傷
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('a')}
              className={`px-6 py-2.5 rounded-xl text-base font-semibold transition-colors ${
                activeTab === 'a'
                  ? 'bg-primary text-white'
                  : 'bg-transparent text-primary hover:bg-primary/10'
              }`}
            >
              A 非外傷
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setSelectedSymptoms(prev => new Set([...prev, 'emerg:cardiac_arrest']))}
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${
              selectedSymptoms.has('emerg:cardiac_arrest') ? 'selected' : ''
            }`}
          >
            <span className="material-symbols-outlined text-sm">cardiology</span>
            <span>心跳停止</span>
          </button>
          <button 
            onClick={() => setSelectedSymptoms(prev => new Set([...prev, 'emerg:direct_to_er']))}
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${
              selectedSymptoms.has('emerg:direct_to_er') ? 'selected' : ''
            }`}
          >
            <span className="material-symbols-outlined text-sm">emergency</span>
            <span>直入急救室</span>
          </button>
        </div>
      </div>
      {triageError && (
        <div className="mb-2 text-xs text-red-500">
          {triageError}
        </div>
      )}

      {/* 輸入區域 */}
      <div className="relative mb-4">
        <textarea 
          className="form-textarea w-full min-h-[100px] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark p-4 focus:ring-primary focus:border-primary resize-none" 
          id="symptoms-detail" 
          placeholder="請輸入患者主訴症狀，系統會根據所有關鍵字持續推薦相關症狀（如：患者主訴頭痛，昨天開始胸悶...）" 
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <button
          type="button"
          onClick={handleVoiceInputClick}
          className="absolute bottom-3 right-3 flex items-center justify-center size-10 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined">mic</span>
        </button>
      </div>

      {/* 推薦症狀 */}
      {recommendedSymptoms.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="text-sm font-semibold text-primary mb-2">推薦症狀</h4>
          <div className="flex flex-wrap gap-2">
            {recommendedSymptoms.map(symptom => (
              <button
                key={symptom}
                onClick={() => addRecommendedSymptom(symptom)}
                className="px-3 py-1 text-sm bg-white border border-primary/30 text-primary rounded-full hover:bg-primary/10 transition-colors"
              >
                + {symptom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 已選症狀標籤 */}
      {symptomTags.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">已選症狀</h4>
          <div className="flex flex-wrap gap-2">
            {symptomTags.map(({ display }) => (
              <div
                key={display}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-sm rounded-full max-w-full"
              >
                <span className="truncate max-w-[10rem]" title={display}>{display}</span>
                <button
                  onClick={() => removeSymptom(display)}
                  className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  title="移除症狀"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 判斷規則：列出各症狀所有 TTAS 判斷依據並可點選 */}
      {symptomTags.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">判斷規則</h4>
          <div className="space-y-2">
            {symptomTags.map(({ display, criteria }) => (
              criteria.length > 0 && (
                <div key={display} className="space-y-1">
                  <div className="text-xs font-semibold text-subtext-light dark:text-subtext-dark">
                    {display}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {criteria.map(item => {
                      const colors = getRuleColors(item.degree);
                      const current = selectedRules[display];
                      const isSelected =
                        !!current &&
                        current.degree === item.degree &&
                        current.judge === item.judge;
                      return (
                        <button
                          key={`${display}-${item.degree}-${item.judge}`}
                          type="button"
                          onClick={() =>
                            setSelectedRules(prev => {
                              const existing = prev[display];
                              const next = { ...prev };
                              if (
                                existing &&
                                existing.degree === item.degree &&
                                existing.judge === item.judge
                              ) {
                                delete next[display];
                              } else {
                                next[display] = { degree: item.degree, judge: item.judge };
                              }
                              return next;
                            })
                          }
                          className={`px-2.5 py-1 rounded-full border text-[10px] leading-snug text-left ${colors.border} ${colors.bg} ${colors.text} ${isSelected ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                          title={`第${item.degree}級：${item.judge}`}
                        >
                          第{item.degree}級：{item.judge}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
          {worstSelectedDegree !== null && (
            <div className="mt-2 text-[11px] text-subtext-light dark:text-subtext-dark">
              所有已選判斷依據中最嚴重的級數：
              <span className="font-semibold">第{worstSelectedDegree}級</span>
            </div>
          )}
        </div>
      )}
      
      <p className="text-xs text-subtext-light dark:text-subtext-dark">💡 系統會自動分析主訴中的所有關鍵字並持續推薦相關症狀，無論游標位置在哪裡。點擊症狀標籤的 ✕ 可移除。包含所有外傷、非外傷、環境症狀。</p>
    </div>
  );
};

export default ChiefComplaint;
