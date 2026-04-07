import React, { useState, useMemo, useEffect, useRef } from 'react';

interface ChiefComplaintProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  activeTab: 't' | 'a';
  setActiveTab: React.Dispatch<React.SetStateAction<'t' | 'a'>>;
  onWorstDegreeChange?: (degree: number | null) => void;
  onDirectToER?: () => void;
  directToERSelected?: boolean;
  age?: number;
  llmMode: 'cloud' | 'local';
  vitals?: {
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
    drugAllergy: string | null;
    painScore: number | null;
    doNotTreat: string;
    sentiment: number | null;
  };
  onChiefComplaintChange?: (data: {
    selectedRules: Record<string, { 
      degree: number; 
      judge: string; 
      rule_code: string;      // ← 加這個
      symptom_name: string;   // ← 加這個
    }>;
    supplementText: string;
  }) => void;
}


const ChiefComplaint: React.FC<ChiefComplaintProps> = ({ 
  
  selectedSymptoms, 
  setSelectedSymptoms, 
  inputText, 
  setInputText, 
  activeTab, 
  setActiveTab, 
  onWorstDegreeChange, 
  onDirectToER, 
  directToERSelected, 
  age,
  llmMode, 
  vitals,
  onChiefComplaintChange,  // ← 新增解構
}) => {
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
  // const LLM_BASE_URL = 'http://localhost:9000';    
  const LLM_BASE_URL = llmMode === 'cloud' 
  ? 'http://localhost:9000'  // 雲端LLM
  : 'http://localhost:8001'; // 本地端LLM


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
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        console.log('[DB] VITE_API_BASE_URL =', API_BASE_URL);

        const res = await fetch(`${API_BASE_URL}/triage_hierarchy`);
        console.log('[DB] fetch triage_hierarchy status =', res.status);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: TriageRow[] = await res.json();
        console.log('[DB] triage rows count =', data?.length ?? 0);
      console.log('[DB] triage rows preview =', (data ?? []).slice(0, 5));

        if (cancelled) return;
        setTriageRows(data ?? []);
      } catch (err: any) {
        console.error('[DB] load triage_hierarchy error =', err);
        if (cancelled) return;
        setTriageError(err?.message ?? '載入 triage_hierarchy（資料庫）失敗');
      }
    };

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, []);

  // 添加狀態來追蹤上次處理的生命徵象
  const [lastProcessedVitals, setLastProcessedVitals] = useState<any>(null);

  // 監聽生命徵象變化，當有異常時自動觸發分析
  useEffect(() => {
    if (!vitals) return;

    // 如果正在錄音，不處理生命徵象更新，避免與語音結束處理衝突
    if (isListening) {
      console.log('[CC] 正在錄音，跳過生命徵象更新');
      return;
    }

    // 檢查是否有生命徵象異常
    const hasAbnormalVitals = Object.keys(vitals).some(key => {
      const value = vitals[key as keyof typeof vitals];
      if (value && typeof value === 'string' && value.trim() !== '') {
        // 簡單檢查一些常見的異常值
        if (key === 'temperature') {
          const temp = parseFloat(value);
          return !isNaN(temp) && temp >= 38.0;
        }
        if (key === 'systolicBP') {
          const systolic = parseFloat(value);
          return !isNaN(systolic) && systolic >= 140;
        }
        if (key === 'heartRate') {
          const hr = parseFloat(value);
          return !isNaN(hr) && (hr >= 120 || hr < 60);
        }
        if (key === 'spo2') {
          const spo2 = parseFloat(value);
          return !isNaN(spo2) && spo2 < 94;
        }
      }
      return false;
    });

    // 如果有異常生命徵象，檢查是否需要更新主訴
    if (hasAbnormalVitals) {
      // 檢查當前主訴是否已經包含所有生命徵象症狀
      const currentSymptoms = inputText.split('、').filter(s => s.trim());
      let needsUpdate = false;
      
      // 檢查是否有新的生命徵象症狀沒有被包含在當前主訴中
      Object.keys(vitals).forEach(key => {
        const value = vitals[key as keyof typeof vitals];
        if (value && typeof value === 'string' && value.trim() !== '') {
          let vitalSymptom = '';
          
          if (key === 'temperature') {
            const temp = parseFloat(value);
            if (!isNaN(temp) && temp >= 38.0) {
              vitalSymptom = '發燒';  // 統一為"發燒"
            }
          } else if (key === 'systolicBP') {
            const systolic = parseFloat(value);
            if (!isNaN(systolic) && systolic >= 140) {
              if (systolic >= 160) vitalSymptom = '重度高血壓';
              else vitalSymptom = '高血壓';
            }
          } else if (key === 'heartRate') {
            const hr = parseFloat(value);
            if (!isNaN(hr) && (hr >= 120 || hr < 60)) {
              vitalSymptom = hr >= 120 ? '心跳過速' : '心跳過緩';
            }
          } else if (key === 'spo2') {
            const spo2 = parseFloat(value);
            if (!isNaN(spo2) && spo2 < 94) {
              vitalSymptom = '低血氧';
            }
          }
          
          // 檢查這個生命徵象症狀是否已經在主訴中
          if (vitalSymptom && !currentSymptoms.some(symptom => 
            symptom.includes(vitalSymptom) || vitalSymptom.includes(symptom))) {
            needsUpdate = true;
          }
        }
      });
      
      // 檢查生命徵象是否有實際變化
      const vitalsChanged = !lastProcessedVitals || 
        JSON.stringify(vitals) !== JSON.stringify(lastProcessedVitals);
      
      // 當有生命徵象異常且有主訴內容時，總是要更新（確保合併）
      if ((needsUpdate || inputText.trim()) && vitalsChanged) {
        console.log('[CC] 檢測到新的生命徵象異常，需要更新主訴');
        console.log('[CC] 當前 inputText:', inputText);
        console.log('[CC] needsUpdate:', needsUpdate);
        setLastProcessedVitals({...vitals}); // 更新上次處理的生命徵象
        
        // 縮短防抖時間，提高響應速度
        const timer = setTimeout(() => {
          // 如果當前有主訴內容，需要合併生命徵象
          if (inputText.trim()) {
            console.log('[CC] 合併現有主訴和生命徵象');
            console.log('[CC] 當前主訴內容:', inputText);
            console.log('[CC] 當前 vitals:', JSON.stringify(vitals, null, 2));
            // 直接傳遞當前主訴，讓後端智能合併生命徵象
            void runLlmSummarizeAndRecommend(inputText);
          } else {
            console.log('[CC] 只有生命徵象，沒有主訴內容');
            console.log('[CC] 當前 vitals:', JSON.stringify(vitals, null, 2));
            void runLlmSummarizeAndRecommend('');
          }
        }, 500); // 延長到 500ms，等待語音處理完成
        
        return () => clearTimeout(timer);
      }
    }
  }, [vitals, inputText, lastProcessedVitals, isListening]);

  // 簡化語音處理，只處理語音辨識，統整成主訴
  const handleVoiceOnly = (rawText: string) => {
    console.log('[VOICE] 語音處理（僅語音）：', rawText);
    // 不設置輸入框內容，等待LLM處理完成後再設置
    void runLlmSummarizeAndRecommend(rawText);
  };

  // 一鍵統整功能
  const handleOneClickIntegrate = () => {
    console.log('[INTEGRATE] 一鍵統整觸發');
    
    // 如果正在錄音，先停止錄音並獲取語音內容
    if (isListening && recognitionRef.current) {
      console.log('[INTEGRATE] 正在錄音中，停止語音辨識');
      
      // 獲取當前語音緩衝內容
      const currentVoiceText = voiceBufferRef.current?.trim() || '';
      console.log('[INTEGRATE] 當前語音緩衝:', currentVoiceText);
      
      // 設置標記，防止語音結束事件重複處理
      voiceProcessedRef.current = true;
      
      // 停止語音辨識
      recognitionRef.current.stop();
      setIsListening(false);
      
      // 手動設置補充資料（逐字稿）
      if (currentVoiceText) {
        setSupplementText(prev => {
          const base = prev || '';
          const lines = base.split('\n').filter(l => l.length > 0);
          // 若任一行已經與這次錄音結果相同，就不要再重複新增
          if (lines.includes(currentVoiceText)) {
            return base;
          }
          return base ? base + (base.endsWith('\n') ? '' : '\n') + currentVoiceText : currentVoiceText;
        });
        
        // 累積整段錄音
        fullVoiceRef.current = fullVoiceRef.current
          ? fullVoiceRef.current + (fullVoiceRef.current.endsWith('\n') ? '' : '\n') + currentVoiceText
          : currentVoiceText;
        
        // 清空語音緩衝
        voiceBufferRef.current = '';
        
        // 直接處理語音內容，不依賴 onend 事件
        console.log('[INTEGRATE] 直接處理語音內容');
        void runLlmSummarizeAndRecommend(currentVoiceText);
      } else {
        // 沒有語音內容，直接統整
        performIntegrate();
      }
    } else {
      // 沒有在錄音，檢查是否有未處理的語音內容
      const unprocessedVoice = fullVoiceRef.current?.trim() || '';
      if (unprocessedVoice && !voiceProcessedRef.current) {
        console.log('[INTEGRATE] 發現未處理的語音內容，直接統整');
        void runLlmSummarizeAndRecommend(unprocessedVoice);
      } else {
        // 沒有語音內容或已處理過，直接統整
        setTimeout(() => {
          performIntegrate();
        }, 50);
      }
    }
  };
  
  // 執行統整的實際邏輯
  const performIntegrate = () => {
    console.log('[INTEGRATE] 執行統整');
    console.log('[INTEGRATE] 當前主訴:', inputText);
    console.log('[INTEGRATE] 當前 vitals:', JSON.stringify(vitals, null, 2));
    
    // 檢查是否有內容需要統整
    const hasContent = inputText.trim() || vitals && Object.keys(vitals).some(key => {
      const value = vitals[key as keyof typeof vitals];
      return value && typeof value === 'string' && value.trim() !== '';
    });
    
    if (!hasContent) {
      console.log('[INTEGRATE] 沒有內容需要統整');
      return;
    }
    
    // 使用當前輸入框的內容加上生命徵象一起統整
    console.log('[INTEGRATE] 統整當前主訴內容:', inputText);
    void runLlmSummarizeAndRecommend(inputText);
  };

  const [recommendedSymptoms, setRecommendedSymptoms] = useState<string[]>([]);
  // LLM 事先為外傷 / 非外傷各自計算好的推薦症狀，切換 Tab 時直接使用
  const [llmTraumaSymptoms, setLlmTraumaSymptoms] = useState<string[] | null>(null);
  const [llmNonTraumaSymptoms, setLlmNonTraumaSymptoms] = useState<string[] | null>(null);
  const [isLlmIntegrating, setIsLlmIntegrating] = useState<boolean>(false);
  const [lastLlmSummary, setLastLlmSummary] = useState<string>('');
  const [recommendationSource, setRecommendationSource] = useState<'llm' | 'fallback' | 'none'>('none');
  const lastRecommendOnlyKeyRef = useRef<string>('');
  const [isSupplementOpen, setIsSupplementOpen] = useState<boolean>(false);
  const [supplementText, setSupplementText] = useState<string>('');

  const summarizeChiefComplaint = async (raw: string): Promise<string> => {
    try {
      console.log('[LLM] sending raw chief complaint to backend:', raw);
      console.log('[LLM] sending vitals to backend:', vitals);
      
      // 如果沒有文字輸入，傳遞空字串給後端，讓後端專門處理生命徵象
      const textToSend = raw || '';
      
      const res = await fetch(`${LLM_BASE_URL}/api/summarize-chief-complaint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToSend,
          llm_mode: llmMode,
          vitals: vitals || {}
        }),
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

    // 一鍵統整流程進行中時，避免即時關鍵字推薦覆蓋 LLM 結果
    if (isLlmIntegrating) return;

    const hasAnyLlmResult = recommendationSource !== 'none';
    const isLlmResultForCurrentInput = trimmed === lastLlmSummary;
    if (isLlmResultForCurrentInput || hasAnyLlmResult) {
      if (activeTab === 't') {
        setRecommendedSymptoms(llmTraumaSymptoms ?? []);
        return;
      }
      setRecommendedSymptoms(llmNonTraumaSymptoms ?? []);
      return;
    }

    // 只要主訴被手動修改（不等於上次 LLM summary），就即時重跑關鍵字推薦
    searchSymptoms(trimmed);
  }, [activeTab, inputText, llmTraumaSymptoms, llmNonTraumaSymptoms, isLlmIntegrating, lastLlmSummary, recommendationSource]);

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
    const map = new Map<string, { degree: number; judge: string; rule_code: string }[]>();  // ← 加 rule_code
    if (!triageRows) return map;

    const isAdult = age !== undefined ? age >= 18 : true;

    for (const row of triageRows) {
      if (row.system_code.startsWith('A') && !isAdult) continue;
      if (row.system_code.startsWith('P') && isAdult) continue;

      const degree = parseInt(row.ttas_degree, 10);
      if (!Number.isFinite(degree) || !row.judge_name) continue;
      const list = map.get(row.symptom_name) ?? [];
      if (!list.some(item => item.rule_code === row.rule_code)) {  // ← 改判重複條件
        list.push({ degree, judge: row.judge_name, rule_code: row.rule_code });  // ← 加 rule_code
      }
      map.set(row.symptom_name, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.degree - b.degree);
    }
    return map;
  }, [triageRows, age]);

  const extractMeaningfulTokens = (text: string): string[] => {
    return text
      // 加入「、」分隔，避免「頭痛、發燒、胸悶」被當成單一 token
      .replace(/[\s\n\r\t,，、。！？；：「」『』（）()\[\]{}]/g, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 2)
      .filter((token, index, arr) => arr.indexOf(token) === index);
  };

  const expandClinicalTerms = (terms: string[]): string[] => {
    const synonymMap: Record<string, string[]> = {
      '胃痛': ['胃痛', '腹痛', '上腹痛', '腹部痛', '腹部不適'],
      '胸悶': ['胸悶', '胸痛', '胸痛/胸悶'],
      '發燒': ['發燒', '發燒/畏寒', '高燒'],
    };
    const expanded = new Set<string>();
    for (const term of terms) {
      expanded.add(term);
      const mapped = synonymMap[term];
      if (mapped) mapped.forEach(item => expanded.add(item));
    }
    return Array.from(expanded);
  };

  const normalizeForRecommend = (text: string): string => {
    return text.replace(/[、，,\s]+$/g, '').trim();
  };

  const getVitalDrivenTerms = (): string[] => {
    if (!vitals) return [];
    const terms: string[] = [];
    const temp = parseFloat(vitals.temperature || '');
    const sugar = parseFloat(vitals.bloodSugar || '');
    if (!Number.isNaN(temp) && temp >= 38) terms.push('發燒', '發燒/畏寒');
    if (!Number.isNaN(sugar) && sugar > 0 && sugar < 70) terms.push('低血糖');
    return Array.from(new Set(terms));
  };

  const isSymptomRelevantToTerms = (symptom: string, terms: string[]): boolean => {
    if (!terms.length) return true;
    return terms.some(term => {
      if (symptom.includes(term) || term.includes(symptom)) return true;
      // 兼容「發燒」與「發燒/畏寒」這種字串不完全相等的情況
      const parts = symptom.split(/[\/、，,]/).map(s => s.trim()).filter(Boolean);
      return parts.some(part => part.includes(term) || term.includes(part));
    });
  };

  const buildMustIncludeSymptoms = (summary: string): string[] => {
    if (!triageRows) return [];
    const isAdult = age !== undefined ? age >= 18 : true;
    const terms = expandClinicalTerms(Array.from(new Set([...extractMeaningfulTokens(summary), ...getVitalDrivenTerms()])));
    if (!terms.length) return [];

    const pool = new Set<string>();
    for (const row of triageRows) {
      const code = row.system_code || '';
      if (!code.startsWith('A') && !code.startsWith('P') && !code.startsWith('T') && !code.startsWith('E')) continue;
      if (code.startsWith('A') && !isAdult) continue;
      if (code.startsWith('P') && isAdult) continue;
      pool.add(row.symptom_name);
    }

    const mustInclude: string[] = [];
    for (const term of terms) {
      const exact = Array.from(pool).find(symptom => symptom === term);
      if (exact) {
        mustInclude.push(exact);
        continue;
      }
      const partial = Array.from(pool).find(symptom => isSymptomRelevantToTerms(symptom, [term]));
      if (partial) mustInclude.push(partial);
    }
    return Array.from(new Set(mustInclude));
  };

  const filterSymptomsByComplaintRelevance = (symptoms: string[], complaint: string): string[] => {
    const tokens = expandClinicalTerms(extractMeaningfulTokens(complaint));
    if (!tokens.length) return symptoms;
    return symptoms.filter(symptom =>
      tokens.some(token => symptom.includes(token) || token.includes(symptom))
    );
  };

  const getSafeFallbackByTab = (summary: string, tab: 't' | 'a'): string[] => {
    const tokens = extractMeaningfulTokens(summary);
    if (!tokens.length || !triageRows) return [];

    const isAdult = age !== undefined ? age >= 18 : true;
    const selectedSet = selectedSymptoms;
    const seen = new Set<string>();
    const results: string[] = [];

    const addIfValid = (symptom: string) => {
      if (seen.has(symptom)) return;
      const alreadySelected = Array.from(selectedSet).some(selected => {
        const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
        return cleanSelected === symptom;
      });
      if (alreadySelected) return;
      if (!tokens.some(token => symptom.includes(token) || token.includes(symptom))) return;
      seen.add(symptom);
      results.push(symptom);
    };

    for (const row of triageRows) {
      const code = row.system_code || '';
      if (tab === 't') {
        if (!code.startsWith('T') && !code.startsWith('E')) continue;
      } else {
        if (!code.startsWith('A') && !code.startsWith('P')) continue;
        if (code.startsWith('A') && !isAdult) continue;
        if (code.startsWith('P') && isAdult) continue;
      }
      addIfValid(row.symptom_name);
      if (results.length >= 5) break;
    }
    return results;
  };

  // 搜尋推薦症狀（基於輸入框中的關鍵詞）
  const searchSymptoms = (text: string, selectedOverride?: Set<string>) => {
    if (!symptomDatabase.length) {
      setRecommendedSymptoms([]);
      return;
    }
    if (text.length < 1) {
      setRecommendedSymptoms([]);
      return;
    }
    
    // 關鍵詞至少 2 字，避免「發」這類單字造成誤推薦
    const allKeywords = extractMeaningfulTokens(text);
    
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
    .slice(0, 5); // 限制為5個推薦，與LLM推薦一致
    
    setRecommendedSymptoms(matches);
  };

  // 統一呼叫一次 RAG + LLM，回傳完整推薦症狀，再由前端分類
  const requestUnifiedRecommendations = async (summary: string): Promise<string[] | null> => {
    if (!triageRows) return null;
    if (!summary.trim()) return null;

    // 提供完整候選清單給 LLM（包含外傷 + 非外傷）
    const isAdult = age !== undefined ? age >= 18 : true;
    const candidateSet = new Set<string>();

    for (const row of triageRows) {
      const code = row.system_code || '';
      // 只保留可用症狀系統：外傷(T/E) + 非外傷(A/P)
      if (!code.startsWith('A') && !code.startsWith('P') && !code.startsWith('T') && !code.startsWith('E')) continue;
      // 非外傷症狀依年齡過濾，外傷不受年齡影響
      if (code.startsWith('A') && !isAdult) continue;
      if (code.startsWith('P') && isAdult) continue;

      candidateSet.add(row.symptom_name);
    }

    const allCandidates = Array.from(candidateSet);
    const relevanceTerms = expandClinicalTerms(Array.from(new Set([...extractMeaningfulTokens(summary), ...getVitalDrivenTerms()])));
    const candidates = allCandidates
      .map(symptom => ({
        symptom,
        score: relevanceTerms.reduce((acc, term) => {
          if (isSymptomRelevantToTerms(symptom, [term])) return acc + 1;
          return acc;
        }, 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 80) // 縮小候選集合，降低 LLM 負擔、提升速度
      .map(item => item.symptom);

    console.log('[LLM] unified recommendation');
    console.log('[LLM] summary =', summary);
    console.log('[LLM] candidates count =', candidates.length, '(from', allCandidates.length, ')');
    console.log('[LLM] candidates preview =', candidates.slice(0, 20));

    if (!candidates.length) return null;

    try {
      console.log('[LLM] requesting symptom recommendations with summary:', summary);
      console.log('[LLM] requesting with vitals:', vitals);
      const res = await fetch(`${LLM_BASE_URL}/api/recommend-symptoms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: summary,
          symptom_candidates: candidates,
          max_results: 5,  // 限制最多5個推薦
          llm_mode: llmMode,
          vitals: vitals || {}
        }),
      });

      if (!res.ok) {
        console.warn('LLM recommend API not ok:', res.status);
        return null;
      }

      const data = await res.json();
      console.log('[LLM] raw recommend response =', data);
      
      const list: string[] = Array.isArray(data?.recommended_symptoms)
        ? data.recommended_symptoms
        : [];

      console.log('[LLM] received recommended_symptoms from backend:', list);

      if (!list.length) return null;

      // 過濾掉已經選中的症狀，並限制顯示數量
      const filtered = list.filter((name, index, arr) => {
        const isFirst = arr.indexOf(name) === index;
        if (!isFirst) return false;
        const already = Array.from(selectedSymptoms).some(selected => {
          const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
          return cleanSelected === name;
        });
        if (already) return false;
        return isSymptomRelevantToTerms(name, relevanceTerms);
      }).slice(0, 5); // 限制為5個推薦，與LLM推薦一致

      return filtered.length > 0 ? filtered : null;
    } catch (err) {
      console.error('LLM recommend error:', err);
      return null;
    }
    return null;
  };

  const splitRecommendationsByTab = (list: string[]): { trauma: string[]; nonTrauma: string[] } => {
    const isAdult = age !== undefined ? age >= 18 : true;
    const trauma: string[] = [];
    const nonTrauma: string[] = [];

    for (const symptom of list) {
      const sysTypes = symptomSystemTypeIndex.get(symptom);
      if (!sysTypes) continue;

      const isTrauma = sysTypes.has('T') || sysTypes.has('E');
      const isNonTraumaAdult = isAdult && sysTypes.has('A');
      const isNonTraumaPediatric = !isAdult && sysTypes.has('P');
      const isNonTrauma = isNonTraumaAdult || isNonTraumaPediatric;

      if (isTrauma) trauma.push(symptom);
      if (isNonTrauma) nonTrauma.push(symptom);
    }

    return {
      trauma: trauma.slice(0, 5),
      nonTrauma: nonTrauma.slice(0, 5),
    };
  };

  // 共用：用 LLM 先整理主訴，再更新推薦症狀
  const runLlmSummarizeAndRecommend = async (rawText?: string) => {
    // 一鍵統整時，優先使用傳入的 rawText，其次使用目前主訴欄位
    let source = '';
    
    // 如果有傳入 rawText（一鍵統整按鈕），需要與現有主訴合併
    if (rawText !== undefined) {
      const currentInput = inputText.trim();
      const newVoice = rawText.trim();
      
      // 檢查新語音是否已經在現有主訴中
      const isAlreadyProcessed = currentInput.includes(newVoice) || 
        newVoice.split(/[、，,]/).some(part => currentInput.includes(part.trim()));
      
      if (isAlreadyProcessed) {
        console.log('[LLM] 語音內容已處理過，跳過合併');
        source = currentInput; // 只使用現有主訴
      } else if (currentInput && newVoice) {
        // 如果都有內容且未處理過，合併處理
        source = `${currentInput}；${newVoice}`;
        console.log('[LLM] 合併現有主訴和新的語音內容');
      } else if (newVoice) {
        // 只有新語音
        source = newVoice;
      } else {
        // 只有現有主訴
        source = currentInput;
      }
    } 
    // 如果有語音內容且還沒清空，使用語音內容
    else if (fullVoiceRef.current) {
      source = fullVoiceRef.current.trim();
    } 
    // 最後使用目前主訴欄位
    else {
      source = inputText.trim();
    }
    
    console.log('[LLM] 整理主訴 source:', source);
    console.log('[LLM] 使用 vitals:', vitals);
    
    // 檢查是否有生命徵象異常，即使沒有文字輸入也要處理
    const hasAbnormalVitals = vitals && Object.keys(vitals).some(key => {
      const value = vitals[key as keyof typeof vitals];
      if (value && typeof value === 'string' && value.trim() !== '') {
        // 簡單檢查一些常見的異常值
        if (key === 'temperature') {
          const temp = parseFloat(value);
          return !isNaN(temp) && temp >= 38.0;
        }
        if (key === 'systolicBP') {
          const systolic = parseFloat(value);
          return !isNaN(systolic) && systolic >= 140;
        }
        if (key === 'heartRate') {
          const hr = parseFloat(value);
          return !isNaN(hr) && (hr >= 120 || hr < 60);
        }
        if (key === 'spo2') {
          const spo2 = parseFloat(value);
          return !isNaN(spo2) && spo2 < 94;
        }
      }
      return false;
    });

    // 如果沒有文字輸入也沒有異常生命徵象，就不處理
    if (!source && !hasAbnormalVitals) {
      console.log('[CC] 沒有文字輸入也沒有異常生命徵象，跳過處理');
      return;
    }

    console.log('[CC] runLlmSummarizeAndRecommend activeTab =', activeTab, 'source =', source, 'hasAbnormalVitals =', hasAbnormalVitals);

    setIsLlmIntegrating(true);
    try {
      const summary = await summarizeChiefComplaint(source);
      setLastLlmSummary(summary.trim());
      // 設置統整後的主訴
      setInputText(summary);

      // 真正 unified RAG：一次檢索 + 一次推薦，再前端分類
      const unifiedList = await requestUnifiedRecommendations(summary);
      const relevantUnified = filterSymptomsByComplaintRelevance(unifiedList ?? [], summary);
      const mustInclude = buildMustIncludeSymptoms(summary);
      console.log('[LLM] must include symptoms =', mustInclude);
      const mergedUnified = Array.from(new Set([...mustInclude, ...relevantUnified]));
      const split = splitRecommendationsByTab(mergedUnified);
      const llmHasResult = split.trauma.length > 0 || split.nonTrauma.length > 0;
      const traumaList = split.trauma.length ? split.trauma : getSafeFallbackByTab(summary, 't');
      const nonTraumaList = split.nonTrauma.length ? split.nonTrauma : getSafeFallbackByTab(summary, 'a');

      setLlmTraumaSymptoms(traumaList);
      setLlmNonTraumaSymptoms(nonTraumaList);
      setRecommendationSource(llmHasResult ? 'llm' : (traumaList.length || nonTraumaList.length ? 'fallback' : 'none'));
      console.log('[LLM] recommendation source =', llmHasResult ? 'llm' : (traumaList.length || nonTraumaList.length ? 'fallback' : 'none'));

      // 一鍵統整後只顯示 LLM 結果，不回退關鍵字推薦
      if (activeTab === 't') {
        setRecommendedSymptoms(traumaList);
      } else {
        setRecommendedSymptoms(nonTraumaList);
      }
    } finally {
      setIsLlmIntegrating(false);
    }

    // 清空語音緩衝
    fullVoiceRef.current = '';
  };

  // 手動編輯主訴後：只重跑 LLM 推薦，不改寫主訴文字本身
  const runLlmRecommendOnly = async (text: string) => {
    const source = text.replace(/[、，,\s]+$/g, '').trim();
    if (!source) {
      setRecommendedSymptoms([]);
      setRecommendationSource('none');
      return;
    }

    setIsLlmIntegrating(true);
    try {
      const unifiedList = await requestUnifiedRecommendations(source);
      const relevantUnified = filterSymptomsByComplaintRelevance(unifiedList ?? [], source);
      const mustInclude = buildMustIncludeSymptoms(source);
      console.log('[LLM] recommend-only must include symptoms =', mustInclude);
      const mergedUnified = Array.from(new Set([...mustInclude, ...relevantUnified]));
      const split = splitRecommendationsByTab(mergedUnified);
      const llmHasResult = split.trauma.length > 0 || split.nonTrauma.length > 0;
      const traumaList = split.trauma.length ? split.trauma : getSafeFallbackByTab(source, 't');
      const nonTraumaList = split.nonTrauma.length ? split.nonTrauma : getSafeFallbackByTab(source, 'a');

      setLlmTraumaSymptoms(traumaList);
      setLlmNonTraumaSymptoms(nonTraumaList);
      setRecommendationSource(llmHasResult ? 'llm' : (traumaList.length || nonTraumaList.length ? 'fallback' : 'none'));

      if (activeTab === 't') {
        setRecommendedSymptoms(traumaList);
      } else {
        setRecommendedSymptoms(nonTraumaList);
      }
    } finally {
      setIsLlmIntegrating(false);
    }
  };

  useEffect(() => {
    if (isListening || isLlmIntegrating) return;
    const trimmed = normalizeForRecommend(inputText);
    if (!trimmed) return;
    // 與上一輪統整內容相同時，不重跑 recommend-only
    if (trimmed === normalizeForRecommend(lastLlmSummary)) return;
    const requestKey = `${trimmed}::${llmMode}::${JSON.stringify(vitals || {})}`;
    if (lastRecommendOnlyKeyRef.current === requestKey) return;

    const timer = setTimeout(() => {
      lastRecommendOnlyKeyRef.current = requestKey;
      void runLlmRecommendOnly(trimmed);
    }, 700);

    return () => clearTimeout(timer);
  }, [inputText, isListening, isLlmIntegrating, lastLlmSummary, llmMode, vitals]);

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
    // 不立即把 recommendationSource 清空，避免輸入中的排序抖動
    // 若目前已有 LLM 結果，輸入中先維持 LLM 顯示，避免順序抖動
    if (recommendationSource !== 'none') {
      if (activeTab === 't') {
        setRecommendedSymptoms(llmTraumaSymptoms ?? []);
      } else {
        setRecommendedSymptoms(llmNonTraumaSymptoms ?? []);
      }
      return;
    }

    // 尚無 LLM 結果時才用關鍵字即時搜尋
    searchSymptoms(text);
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Enter 不再自動觸發 LLM，等待用戶點擊一鍵統整
      console.log('[KEY] Enter pressed, waiting for one-click integrate');
    }
  };

  // 注意：
  // 手動輸入主訴時只做推薦更新，不自動改寫主訴內容。
  // 主訴統整（可能改變順序/措辭）僅在按下「一鍵統整」時執行。

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
    recognition.interimResults = false;  // 改回 false，只處理最終結果
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

      // 如果已經被一鍵統整處理過，跳過
      if (voiceProcessedRef.current) {
        console.log('[VOICE] onend skipped due to one-click integrate');
        voiceProcessedRef.current = false; // 重置標記
        return;
      }

      const raw = voiceBufferRef.current.trim();
      console.log('[VOICE] final raw text =', raw);
      
      if (raw) {
        // 設置補充資料（逐字稿）
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
        startListening();
        return;
      }

      // 錄音真正結束：用整段累積內容送給 LLM 做整理
      if (raw) {
        console.log('[VOICE] 語音結束，處理內容：', raw);
        
        // 檢查是否有生命徵象異常
        const hasAbnormalVitals = vitals && Object.keys(vitals).some(key => {
          const value = vitals[key as keyof typeof vitals];
          if (value && typeof value === 'string' && value.trim() !== '') {
            if (key === 'temperature') {
              const temp = parseFloat(value);
              return !isNaN(temp) && temp >= 38.0;
            }
            if (key === 'systolicBP') {
              const systolic = parseFloat(value);
              return !isNaN(systolic) && systolic >= 140;
            }
            if (key === 'heartRate') {
              const hr = parseFloat(value);
              return !isNaN(hr) && (hr >= 120 || hr < 60);
            }
            if (key === 'spo2') {
              const spo2 = parseFloat(value);
              return !isNaN(spo2) && spo2 < 94;
            }
          }
          return false;
        });
        
        console.log('[VOICE] 檢測到生命徵象異常：', hasAbnormalVitals);
        console.log('[VOICE] 當前 vitals：', JSON.stringify(vitals, null, 2));
        
        // 直接處理語音，不考慮生命徵象
        console.log('[VOICE] 正常處理語音');
        handleVoiceOnly(raw);
        
        // 處理完成後清空 fullVoiceRef，避免重複處理
        fullVoiceRef.current = '';
      }
    };

    recognition.onresult = (event: any) => {
      // 只取最新一個 result，避免每次都從 results[0] 取而造成整句重複累積
      const lastIndex = event.results.length - 1;
      const transcript = (event.results[lastIndex][0].transcript as string) || '';
      if (!transcript) return;

      const base = voiceBufferRef.current || '';
      voiceBufferRef.current = base ? base + (base.endsWith('\n') ? '' : '\n') + transcript : transcript;
    };

    recognition.onerror = (e: any) => {
      console.error('[VOICE] error:', e?.error ?? e);
      setIsListening(false);
      recognitionRef.current = null;
    };

    const startListening = () => {
      if (!recognition) {
        console.error('[VOICE] SpeechRecognition not supported');
        return;
      }

      setIsListening(true);
      voiceProcessedRef.current = false; // 重置語音處理標記
      recognition.start();
      console.log('[VOICE] start');
    };

    try {
      startListening();
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
    const map = new Map<string, { 
      display: string; 
      degrees: number | undefined; 
      criteria: { degree: number; judge: string; rule_code: string }[]  // ← 加 rule_code
    }>();

    for (const key of selectedSymptoms) {
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

  const [selectedRules, setSelectedRules] = useState<Record<string, { 
    degree: number; 
    judge: string;
    rule_code: string;      // ← 新增
    symptom_name: string;   // ← 新增
}>>({});
  const [recommendedRules, setRecommendedRules] = useState<Array<{
    rule_code: string;
    symptom_name: string;
    judge_name: string;
    ttas_degree: number;
  }>>([]);
  const [isRecommendRulesLoading, setIsRecommendRulesLoading] = useState(false);

  useEffect(() => {
    const selectedSymptomNames = symptomTags.map(tag => tag.display);
    if (selectedSymptomNames.length === 0) {
      setRecommendedRules([]);
      setIsRecommendRulesLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsRecommendRulesLoading(true);
      try {
        const res = await fetch(`${LLM_BASE_URL}/api/recommend-rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_symptoms: selectedSymptomNames,
            vitals: vitals || {},
            llm_mode: llmMode,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const normalized = Array.isArray(data?.recommended_rules)
          ? data.recommended_rules
              .filter((rule: any) =>
                rule &&
                typeof rule.rule_code === 'string' &&
                typeof rule.symptom_name === 'string' &&
                typeof rule.judge_name === 'string' &&
                Number.isFinite(Number(rule.ttas_degree))
              )
              .map((rule: any) => ({
                rule_code: rule.rule_code,
                symptom_name: rule.symptom_name,
                judge_name: rule.judge_name,
                ttas_degree: Number(rule.ttas_degree),
              }))
          : [];
        setRecommendedRules(normalized.slice(0, 3));
      } catch (err) {
        console.error('[RULES] 推薦判斷規則失敗', err);
        if (!cancelled) setRecommendedRules([]);
      } finally {
        if (!cancelled) setIsRecommendRulesLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symptomTags, vitals, llmMode, LLM_BASE_URL]);

  useEffect(() => {
    // 根據當前已選症狀，自動處理部分規則：
    // 1) 移除已不在 symptomTags 中的規則
    // 2) 若「心跳停止」只對應一條判斷依據，則自動帶入
    const tagNames = new Set(symptomTags.map(t => t.display));

    setSelectedRules(prev => {
      const next: Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }> = {};

      for (const [ruleCode, ruleData] of Object.entries(prev)) {
        if (tagNames.has(ruleData.symptom_name)) {  // ← 改用 symptom_name 判斷
          next[ruleCode] = ruleData;
        }
      }

      // 對「心跳停止」自動帶入唯一一條規則
      if (tagNames.has('心跳停止') && !Object.values(next).some(r => r.symptom_name === '心跳停止')) {
        const criteria = symptomCriteriaIndex.get('心跳停止') ?? [];
        if (criteria.length === 1) {
          next[criteria[0].rule_code] = {
            degree: criteria[0].degree,
            judge: criteria[0].judge,
            rule_code: criteria[0].rule_code,
            symptom_name: '心跳停止',
          };
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
    if (onWorstDegreeChange) {
      onWorstDegreeChange(worstSelectedDegree);
    }
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

  // 每當 selectedRules 或 supplementText 變化時，傳回 App
  useEffect(() => {
    const timer = setTimeout(() => {
      onChiefComplaintChange?.({
        selectedRules,
        supplementText,
      });
    }, 100); // ← 100ms debounce

    return () => clearTimeout(timer);
  }, [selectedRules, supplementText, onChiefComplaintChange]);

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
        <div className="flex gap-2">
          <textarea 
            className="form-textarea flex-1 min-h-[80px] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark p-4 pr-28 focus:ring-primary focus:border-primary resize-none" 
            id="symptoms-detail" 
            placeholder="請輸入患者主訴症狀，系統會根據所有關鍵字持續推薦相關症狀（如：患者主訴頭痛，昨天開始胸悶...）" 
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isListening}
          />
          <button
            onClick={handleOneClickIntegrate}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors text-sm font-medium whitespace-nowrap"
            title="統整主訴與生命徵象"
          >
            一鍵統整
          </button>
        </div>
        <button
          type="button"
          onClick={handleVoiceInputClick}
          className={`absolute bottom-3 right-28 flex items-center justify-center size-10 rounded-full text-white transition-all duration-200 shadow-md ${
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
          {(isRecommendRulesLoading || recommendedRules.length > 0) && (
            <div className="mb-3 pb-3 border-b border-dashed border-primary/40">
              <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-2">
                <span>AI 推薦判斷規則</span>
                {isRecommendRulesLoading && (
                  <span className="text-[10px] text-subtext-light dark:text-subtext-dark">分析中...</span>
                )}
              </div>
              {recommendedRules.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recommendedRules.map(rule => {
                    const colors = getRuleColors(rule.ttas_degree);
                    const isSelected = !!selectedRules[rule.rule_code];
                    return (
                      <button
                        key={rule.rule_code}
                        type="button"
                        onClick={() =>
                          setSelectedRules(prev => {
                            const next = { ...prev };
                            Object.keys(next).forEach(ruleCode => {
                              if (next[ruleCode].symptom_name === rule.symptom_name) {
                                delete next[ruleCode];
                              }
                            });
                            if (prev[rule.rule_code]) return next;
                            next[rule.rule_code] = {
                              degree: rule.ttas_degree,
                              judge: rule.judge_name,
                              rule_code: rule.rule_code,
                              symptom_name: rule.symptom_name,
                            };
                            return next;
                          })
                        }
                        className={`px-2.5 py-1 rounded-full border text-[10px] leading-snug text-left ${colors.border} ${isSelected ? `${colors.bg.replace('10', '90')} text-white ring-2 ring-offset-1 ring-primary` : `${colors.bg} ${colors.text}`}`}
                        title={`${rule.symptom_name}｜第${rule.ttas_degree}級：${rule.judge_name}`}
                      >
                        {rule.symptom_name}｜第{rule.ttas_degree}級：{rule.judge_name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                      // ← 把多餘的 current 那行刪掉
                      const isSelected = !!selectedRules[item.rule_code];
                      return (
                        <button
                          key={item.rule_code}
                          type="button"
                          onClick={() =>
                            setSelectedRules(prev => {
                              const next = { ...prev };
                              const existing = prev[item.rule_code];

                              // 先移除同一症狀已選的其他規則
                              Object.keys(next).forEach(ruleCode => {
                                if (next[ruleCode].symptom_name === display) {
                                  delete next[ruleCode];
                                }
                              });

                              // 如果原本點的這顆就是已選狀態，代表取消，不重加
                              if (existing) {
                                return next;
                              }

                              // 否則改成這個症狀目前唯一選中的規則
                              next[item.rule_code] = {
                                degree: item.degree,
                                judge: item.judge,
                                rule_code: item.rule_code,
                                symptom_name: display,
                              };

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
