import React, { useState, useMemo, useEffect, useRef } from 'react';

interface ChiefComplaintProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  activeTab: 't' | 'a';
  setActiveTab: React.Dispatch<React.SetStateAction<'t' | 'a'>>;
  onWorstDegreeChange: (degree: number | null) => void;
  onDirectToER: () => void;
  directToERSelected: boolean;
  age?: number; // 病患年齡，用於成人(A)/兒童(P)規則切換
}

const ChiefComplaint: React.FC<ChiefComplaintProps> = ({ selectedSymptoms, setSelectedSymptoms, inputText, setInputText, activeTab, setActiveTab, onWorstDegreeChange, onDirectToER, directToERSelected, age }) => {
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
  const voiceProcessedRef = useRef(false);
  const voiceBufferRef = useRef<string>('');
  const fullVoiceRef = useRef<string>('');
  const langSwitchRef = useRef(false);
  const speechLangRef = useRef<'zh-TW' | 'en-US'>('zh-TW');
  const [speechLang, setSpeechLang] = useState<'zh-TW' | 'en-US'>('zh-TW');

  useEffect(() => {
    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const res = await fetch('http://localhost:8000/triage_hierarchy');
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

  const [recommendedSymptoms, setRecommendedSymptoms] = useState<string[]>([]);
  // LLM 事先為外傷 / 非外傷各自計算好的推薦症狀，切換 Tab 時直接使用
  const [llmTraumaSymptoms, setLlmTraumaSymptoms] = useState<string[] | null>(null);
  const [llmNonTraumaSymptoms, setLlmNonTraumaSymptoms] = useState<string[] | null>(null);
  const [isSupplementOpen, setIsSupplementOpen] = useState<boolean>(false);
  const [supplementText, setSupplementText] = useState<string>('');

  const summarizeChiefComplaint = async (raw: string): Promise<string> => {
    try {
      console.log('[LLM] sending raw chief complaint to backend:', raw);
      const res = await fetch('http://localhost:3001/api/summarize-chief-complaint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: raw }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[LLM] backend returned non-OK status', res.status, text);
        alert('AI 主訴整理失敗（後端狀態碼 ' + res.status + '），已保留原始主訴。');
        return raw;
      }
      const data = await res.json();
      const summary =
        data && typeof data.summary === 'string' && data.summary.trim().length > 0
          ? data.summary
          : raw;
      console.log('[LLM] received summary from backend:', summary);
      return summary;
    } catch (err) {
      console.error('[LLM] error while calling backend:', err);
      alert('AI 主訴整理時發生錯誤，已保留原始主訴。');
      return raw;
    }
  };

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

    const isAdult = age !== undefined ? age >= 18 : true;

    for (const row of triageRows) {
      // 依 system_code 開頭決定成人/兒童規則：A*=成人、P*=兒童，其餘(T*/E*)一律保留
      if (row.system_code.startsWith('A') && !isAdult) continue;
      if (row.system_code.startsWith('P') && isAdult) continue;

      const degree = parseInt(row.ttas_degree, 10);
      if (!Number.isFinite(degree)) continue;
      const existing = map.get(row.symptom_name);
      if (existing === undefined || degree < existing) {
        map.set(row.symptom_name, degree);
      }
    }
    return map;
  }, [triageRows, age]);

  // Tab 切換或主訴變更時：
  // 1) 若該 Tab 已有對應的 LLM 推薦結果，直接顯示（完全不再呼叫 LLM）
  // 2) 否則使用關鍵字推薦
  useEffect(() => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setRecommendedSymptoms([]);
      return;
    }

    if (activeTab === 't' && llmTraumaSymptoms && llmTraumaSymptoms.length) {
      setRecommendedSymptoms(llmTraumaSymptoms);
      return;
    }

    if (activeTab === 'a' && llmNonTraumaSymptoms && llmNonTraumaSymptoms.length) {
      setRecommendedSymptoms(llmNonTraumaSymptoms);
      return;
    }

    // 若該 Tab 尚無 LLM 結果，則使用關鍵字推薦
    searchSymptoms(trimmed);
  }, [activeTab, inputText, llmTraumaSymptoms, llmNonTraumaSymptoms]);

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

  // 每個症狀出現過的 system_code 類型（A/P/T/E），用來更精準區分外傷/非外傷
  const symptomSystemTypeIndex = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!triageRows) return map;
    for (const row of triageRows) {
      const first = (row.system_code || '').charAt(0);
      if (!first) continue;
      const set = map.get(row.symptom_name) ?? new Set<string>();
      set.add(first);
      map.set(row.symptom_name, set);
    }
    return map;
  }, [triageRows]);

  // 每個症狀對應的所有 TTAS 判斷依據 (級數 + 說明)
  const symptomCriteriaIndex = useMemo(() => {
    const map = new Map<string, { degree: number; judge: string }[]>();
    if (!triageRows) return map;

    const isAdult = age !== undefined ? age >= 18 : true;

    for (const row of triageRows) {
      // 依 system_code 開頭決定成人/兒童規則：A*=成人、P*=兒童，其餘(T*/E*)一律保留
      if (row.system_code.startsWith('A') && !isAdult) continue;
      if (row.system_code.startsWith('P') && isAdult) continue;

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
  }, [triageRows, age]);

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
    const isAdult = age !== undefined ? age >= 18 : true;
    console.log('[CC] searchSymptoms activeTab =', activeTab, 'category =', currentCategory);

    const matches = symptomDatabase.filter(symptom => {
      // 先用類別過濾：只推薦屬於目前 T/A 類別的症狀
      const cats = symptomCategoryIndex.get(symptom);
      if (!cats || !cats.has(currentCategory)) return false;

      // 再用 system_code 開頭嚴格區分外傷/非外傷 + 成人/兒童
      const sysTypes = symptomSystemTypeIndex.get(symptom);
      if (!sysTypes) return false;

      if (currentCategory === '非外傷') {
        // 非外傷：只接受 A*/P* 系統
        if (!sysTypes.has('A') && !sysTypes.has('P')) return false;
        // 成人只推薦有 A* 的症狀，兒童只推薦有 P* 的症狀
        if (isAdult && !sysTypes.has('A')) return false;
        if (!isAdult && !sysTypes.has('P')) return false;
      } else {
        // 外傷：只接受 T*/E* 系統
        if (!sysTypes.has('T') && !sysTypes.has('E')) return false;
      }
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

  // 透過後端 LLM 從候選清單中推薦症狀
  // 回傳該 Tab 對應的推薦症狀陣列（若無合理結果則回傳 null）
  const requestLlmRecommendations = async (summary: string, tab: 't' | 'a'): Promise<string[] | null> => {
    if (!triageRows) return null;
    if (!summary.trim()) return null;

    const currentCategory = tab === 't' ? '外傷' : '非外傷';
    console.log('[CC] requestLlmRecommendations tab =', tab, 'current category =', currentCategory);

    // 只提供目前類別的症狀給 LLM 當候選：
    // 直接從 triageRows 過濾，使用與其他地方一致的年齡/類別邏輯
    const isAdult = age !== undefined ? age >= 18 : true;
    const candidateSet = new Set<string>();

    for (const row of triageRows) {
      if (row.category !== currentCategory) continue;

      const code = row.system_code || '';

      // 進一步用 system_code 嚴格區分外傷/非外傷：
      // - 非外傷：只接受 A*/P*，排除 T*/E*
      // - 外傷：只接受 T*/E*，排除 A*/P*
      if (currentCategory === '非外傷') {
        if (!code.startsWith('A') && !code.startsWith('P')) continue;

        // 非外傷症狀依 A*/P* 與年齡切換
        if (code.startsWith('A') && !isAdult) continue;
        if (code.startsWith('P') && isAdult) continue;
      } else {
        // 外傷模式下，僅接受 T*/E* 系統
        if (!code.startsWith('T') && !code.startsWith('E')) continue;
      }

      candidateSet.add(row.symptom_name);
    }

    const candidates = Array.from(candidateSet);

    if (!candidates.length) return null;

    try {
      console.log('[LLM] requesting symptom recommendations with summary:', summary);
      const res = await fetch('http://localhost:3001/api/recommend-symptoms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: summary,
          symptom_candidates: candidates,
          max_results: 10,
        }),
      });

      if (!res.ok) {
        console.warn('LLM recommend API not ok:', res.status);
        return null;
      }

      const data = await res.json();
      const list: string[] = Array.isArray(data?.recommended_symptoms)
        ? data.recommended_symptoms
        : [];

      console.log('[LLM] received recommended_symptoms from backend:', list);

      if (!list.length) return null;

      // 過濾掉已經選中的症狀，並限制顯示數量
      const filtered = list.filter(name => {
        const already = Array.from(selectedSymptoms).some(selected => {
          const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
          return cleanSelected === name;
        });
        return !already;
      }).slice(0, 10);

      return filtered.length > 0 ? filtered : null;
    } catch (err) {
      console.error('LLM recommend error:', err);
      return null;
    }
    return null;
  };

  // 共用：用 LLM 先整理主訴，再更新推薦症狀
  const runLlmSummarizeAndRecommend = async (rawText?: string) => {
    // 優先使用錄音整段逐字稿，其次使用呼叫方傳入的 rawText，最後才用目前主訴欄位
    const source = (fullVoiceRef.current || rawText || inputText || '').trim();
    if (!source) return;

    console.log('[CC] runLlmSummarizeAndRecommend activeTab =', activeTab, 'source =', source);

    const summary = await summarizeChiefComplaint(source);
    setInputText(summary);

    // 讓 LLM 針對外傷 / 非外傷各自產生一組推薦清單，之後切換 Tab 時直接使用
    const [traumaList, nonTraumaList] = await Promise.all([
      requestLlmRecommendations(summary, 't'),
      requestLlmRecommendations(summary, 'a'),
    ]);

    setLlmTraumaSymptoms(traumaList ?? []);
    setLlmNonTraumaSymptoms(nonTraumaList ?? []);

    // 依當下 Tab 選擇要顯示哪一組推薦；若該組沒有 LLM 結果，則退回關鍵字推薦
    if (activeTab === 't' && traumaList && traumaList.length) {
      setRecommendedSymptoms(traumaList);
    } else if (activeTab === 'a' && nonTraumaList && nonTraumaList.length) {
      setRecommendedSymptoms(nonTraumaList);
    } else {
      searchSymptoms(source);
    }
  };

  const isSymptomSelectedByLabel = (label: string) => {
    return Array.from(selectedSymptoms).some(selected => {
      const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
      return cleanSelected === label;
    });
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
      // Enter 觸發：用目前主訴呼叫 LLM 進行「整理＋推薦」
      void runLlmSummarizeAndRecommend(inputText);
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('此瀏覽器不支援語音輸入 (SpeechRecognition)。請改用 Chrome 等支援的瀏覽器。');
      return;
    }

    // 若已有 recognition 物件在，先停止它（防止多個 recognition 並行）
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = speechLangRef.current;
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[VOICE] start');
      setIsListening(true);
      voiceBufferRef.current = '';
      voiceProcessedRef.current = false;
    };

    recognition.onend = () => {
      console.log('[VOICE] end, buffer =', voiceBufferRef.current);
      setIsListening(false);
      recognitionRef.current = null;

      const raw = voiceBufferRef.current.trim();
      console.log('[VOICE] final raw text =', raw);
      if (raw) {
        setSupplementText(prev => {
          const base = prev || '';
          const lines = base.split('\n').filter(l => l.length > 0);
          // 若任一行已經與這次錄音結果相同，就不要再重複新增
          if (lines.includes(raw)) {
            return base;
          }
          return base ? base + (base.endsWith('\n') ? '' : '\n') + raw : raw;
        });

        // 累積整段錄音（可能包含多次語言切換）
        fullVoiceRef.current = fullVoiceRef.current
          ? fullVoiceRef.current + (fullVoiceRef.current.endsWith('\n') ? '' : '\n') + raw
          : raw;
      }
      voiceBufferRef.current = '';

      // 若是為了切換語言而停止，處理完這一段後，用最新語言重新開始
      if (langSwitchRef.current) {
        console.log('[VOICE] onend due to lang switch, restarting with lang =', speechLangRef.current);
        langSwitchRef.current = false;
        voiceProcessedRef.current = false;
        startSpeechRecognition();
        return;
      }

      // 防止重複執行：檢查是否已經處理過（只在真正結束錄音時生效）
      if (voiceProcessedRef.current) {
        console.log('[VOICE] onend already processed, skip');
        return;
      }
      voiceProcessedRef.current = true;

      // 錄音真正結束：用整段累積內容送給 LLM 做整理
      const fullRaw = (fullVoiceRef.current || raw).trim();
      if (fullRaw) {
        void runLlmSummarizeAndRecommend(fullRaw);
      }
      fullVoiceRef.current = '';
    };

    recognition.onresult = (event: any) => {
      console.log('[VOICE] result event:', event);
      // 只取最新一個 result，避免每次都從 results[0] 取而造成整句重複累積
      const lastIndex = event.results.length - 1;
      const transcript = (event.results[lastIndex][0].transcript as string) || '';
      console.log('[VOICE] transcript =', transcript);
      if (!transcript) return;

      const base = voiceBufferRef.current || '';
      // 若這次辨識結果已經完整出現在目前累積內容中，就不要再重複新增
      if (!base.includes(transcript)) {
        voiceBufferRef.current = base ? base + (base.endsWith('\n') ? '' : '\n') + transcript : transcript;
      }
      console.log('[VOICE] buffer now =', voiceBufferRef.current);
    };

    recognition.onerror = (e: any) => {
      console.error('[VOICE] error:', e?.error ?? e);
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      // 有些瀏覽器若重複呼叫 start 會丟錯誤，這裡忽略即可
    }
  };

  const handleVoiceInputClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('此瀏覽器不支援語音輸入 (SpeechRecognition)。請改用 Chrome 等支援的瀏覽器。');
      return;
    }

    // 若已在聽，則停止（這種停止代表使用者結束錄音，需要總結）
    if (isListening && recognitionRef.current) {
      try {
        langSwitchRef.current = false;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      return;
    }

    // 開始新的錄音段落時，重置整段累積內容
    fullVoiceRef.current = '';
    voiceBufferRef.current = '';
    voiceProcessedRef.current = false;
    startSpeechRecognition();
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
      return next;
    });

    // 點選後只把該顆從目前推薦列表中移除，其它保持不變
    setRecommendedSymptoms(prev => prev.filter(s => s !== symptom));
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

  useEffect(() => {
    // 根據當前已選症狀，自動處理部分規則：
    // 1) 移除已不在 symptomTags 中的規則
    // 2) 若「心跳停止」只對應一條判斷依據，則自動帶入
    const tagNames = new Set(symptomTags.map(t => t.display));

    setSelectedRules(prev => {
      const next: Record<string, { degree: number; judge: string }> = {};

      // 保留仍存在於 symptomTags 裡的規則
      for (const name of tagNames) {
        const existing = prev[name];
        if (existing) {
          next[name] = existing;
          continue;
        }

        // 對「心跳停止」自動帶入唯一一條規則
        if (name === '心跳停止') {
          const criteria = symptomCriteriaIndex.get(name) ?? [];
          if (criteria.length === 1) {
            next[name] = { degree: criteria[0].degree, judge: criteria[0].judge };
          }
        }
      }

      return next;
    });
  }, [symptomTags, symptomCriteriaIndex]);

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
              {(age !== undefined ? (age >= 18 ? 'A' : 'P') : 'A')} 非外傷
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() =>
              setSelectedSymptoms(prev => {
                const label = '心跳停止';
                const alreadyHas = Array.from(prev).some(selected => {
                  const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
                  return cleanSelected === label;
                });
                if (alreadyHas) return prev;
                return new Set([...prev, `manual:${label}`]);
              })
            }
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${
              isSymptomSelectedByLabel('心跳停止') ? 'selected' : ''
            }`}
          >
            <span className="material-symbols-outlined text-sm">cardiology</span>
            <span>心跳停止</span>
          </button>
          <button 
            type="button"
            onClick={onDirectToER}
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${directToERSelected ? 'selected' : ''}`}
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
          className={`absolute bottom-3 right-3 flex items-center justify-center size-10 rounded-full text-white transition-all duration-200 shadow-md ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/50 animate-pulse'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          <span className="material-symbols-outlined">{isListening ? 'stop_circle' : 'mic'}</span>
        </button>
      </div>

      {/* 補充資料（可折疊） */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsSupplementOpen(prev => !prev)}
            className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
          >
            <span className="material-symbols-outlined text-sm">
              {isSupplementOpen ? 'expand_less' : 'expand_more'}
            </span>
            <span>補充資料</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-subtext-light dark:text-subtext-dark">
            <span className="material-symbols-outlined text-base">translate</span>
            <button
              type="button"
              onClick={() => {
                if (speechLangRef.current === 'zh-TW') {
                  setSpeechLang('zh-TW');
                  return;
                }
                speechLangRef.current = 'zh-TW';
                setSpeechLang('zh-TW');
                if (isListening && recognitionRef.current) {
                  try {
                    langSwitchRef.current = true;
                    recognitionRef.current.stop();
                  } catch {
                    // ignore
                  }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                speechLang === 'zh-TW'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
              }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => {
                if (speechLangRef.current === 'en-US') {
                  setSpeechLang('en-US');
                  return;
                }
                speechLangRef.current = 'en-US';
                setSpeechLang('en-US');
                if (isListening && recognitionRef.current) {
                  try {
                    langSwitchRef.current = true;
                    recognitionRef.current.stop();
                  } catch {
                    // ignore
                  }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                speechLang === 'en-US'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
              }`}
            >
              English
            </button>
          </div>
        </div>
        {isSupplementOpen && (
          <div className="mt-2">
            <textarea
              className="form-textarea w-full min-h-[80px] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark p-3 focus:ring-primary focus:border-primary resize-none text-sm"
              placeholder="可輸入補充說明（例如：既往病史、用藥、家屬提供的額外資訊等）"
              value={supplementText}
              onChange={(e) => setSupplementText(e.target.value)}
              rows={3}
            />
          </div>
        )}
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
                          className={`px-2.5 py-1 rounded-full border text-[10px] leading-snug text-left ${colors.border} ${isSelected ? `${colors.bg.replace('10', '90')} text-white ring-2 ring-offset-1 ring-primary` : `${colors.bg} ${colors.text}`}`}
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
