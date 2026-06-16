import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import { toTaiwanTraditional } from '../utils/toTaiwanTraditional';
import {
  buildPresentationRules,
  buildPresentationSymptomList,
  detectPresentationScenario,
  sleep,
  type PresentationScenario,
} from '../config/presentationScenarios';
import { getApiBaseUrl, getLlmBaseUrl } from '../config/serviceUrls';

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
  voiceConsented?: boolean;
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
  sessionRestore?: {
    token: number;
    selectedRules: Record<string, {
      degree: number;
      judge: string;
      rule_code: string;
      symptom_name: string;
    }>;
    recommendedSymptoms: string[];
    supplementText: string;
  } | null;
  restoredSelectedRules?: Record<string, {
    degree: number;
    judge: string;
    rule_code: string;
    symptom_name: string;
  }>;
  restoredSelectedRulesKey?: number | null;
  onSessionRestoreApplied?: () => void;
}

type SpeechLang = 'zh-TW' | 'en-US' | 'ja-JP' | 'vi-VN' | 'id-ID';

interface ChiefComplaintSymptomTag {
  display: string;
  degrees: number | undefined;
  criteria: { degree: number; judge: string; rule_code: string }[];
}

interface ChiefComplaintContextApi {
  triageError: string | null;
  activeTab: 't' | 'a';
  setActiveTab: React.Dispatch<React.SetStateAction<'t' | 'a'>>;
  age: number | undefined;
  isSymptomSelectedByLabel: (label: string) => boolean;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isListening: boolean;
  handleOneClickIntegrate: () => void;
  isLlmIntegrating: boolean;
  handleVoiceInputClick: () => void;
  voiceConsented: boolean;
  isSupplementOpen: boolean;
  setIsSupplementOpen: React.Dispatch<React.SetStateAction<boolean>>;
  supplementText: string;
  setSupplementText: React.Dispatch<React.SetStateAction<string>>;
  speechLang: SpeechLang;
  setSpeechLang: React.Dispatch<React.SetStateAction<SpeechLang>>;
  speechLangRef: React.MutableRefObject<SpeechLang>;
  recognitionRef: React.MutableRefObject<any | null>;
  langSwitchRef: React.MutableRefObject<boolean>;
  recommendedSymptoms: string[];
  addRecommendedSymptom: (symptom: string) => void;
  symptomTags: ChiefComplaintSymptomTag[];
  removeSymptom: (symptomDisplay: string) => void;
  isRecommendRulesLoading: boolean;
  recommendedRules: Array<{
    rule_code: string;
    symptom_name: string;
    judge_name: string;
    ttas_degree: number;
  }>;
  recommendedRulesBySymptom: ReadonlyArray<readonly [string, Array<{
    rule_code: string;
    symptom_name: string;
    judge_name: string;
    ttas_degree: number;
  }>]>;
  selectedRules: Record<string, {
    degree: number;
    judge: string;
    rule_code: string;
    symptom_name: string;
  }>;
  setSelectedRules: React.Dispatch<React.SetStateAction<Record<string, {
    degree: number;
    judge: string;
    rule_code: string;
    symptom_name: string;
  }>>>;
  getRuleColors: (degree: number) => { border: string; bg: string; text: string };
  worstSelectedDegree: number | null;
  chiefComplaintAiHighlight: boolean;
  recommendSymptomsAiHighlight: boolean;
  aiRulesAiHighlight: boolean;
}

type AiHighlightKey = 'chief' | 'symptoms' | 'rules';

type RecommendedRuleItem = {
  rule_code: string;
  symptom_name: string;
  judge_name: string;
  ttas_degree: number;
};

const AI_HIGHLIGHT_MS = 1150;

const TRAUMA_MECHANISM_KEYWORDS = [
  '車禍', '车祸', '跌倒', '摔倒', '摔到', '摔傷', '摔伤', '撞到', '碰撞', '撞擊', '撞击',
  '機車', '机车', '摩托', '汽車', '汽车', '被車', '車撞',
  '骨折', '脫臼', '脱臼', '扭傷', '扭伤', '外傷', '外伤',
  '擦傷', '擦伤', '撕裂傷', '撕裂伤', '鈍傷', '钝伤', '穿刺傷', '穿刺伤',
  '刀傷', '刀伤', '刺傷', '刺伤', '燙傷', '烫伤', '燒傷', '烧伤', '燒燙傷',
  '利刃', '切割傷', '槍傷', '枪伤', '爆炸', '墜落', '坠落', '高處', '高处',
  '創傷性截肢', '创伤性截肢', '截肢',
];

const hasTraumaMechanism = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  return TRAUMA_MECHANISM_KEYWORDS.some(kw => t.includes(kw));
};

const ChiefComplaintContext = createContext<ChiefComplaintContextApi | null>(null);

function useChiefComplaintApi(): ChiefComplaintContextApi {
  const ctx = useContext(ChiefComplaintContext);
  if (!ctx) throw new Error('ChiefComplaint 元件須包在 ChiefComplaintProvider 內');
  return ctx;
}

export const ChiefComplaintProvider: React.FC<ChiefComplaintProps & { children: React.ReactNode }> = ({
  children,

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
  voiceConsented = true,
  vitals,
  onChiefComplaintChange,  // ← 新增解構
  sessionRestore,
  restoredSelectedRules,
  restoredSelectedRulesKey,
  onSessionRestoreApplied,
}) => {
  // 保留 prop 定義（依需求不刪 interface 與 prop），目前畫面不直接使用
  void onDirectToER;
  void directToERSelected;

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
  const LLM_BASE_URL = getLlmBaseUrl();


  const [triageRows, setTriageRows] = useState<TriageRow[] | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const pendingSessionRestoreRef = useRef<NonNullable<ChiefComplaintProps['sessionRestore']> | null>(null);
  const sessionRestoreRulesAppliedRef = useRef(false);
  const lastAppliedRestoreKeyRef = useRef<number | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const [isListening, setIsListening] = useState(false);
  const voiceProcessedRef = useRef(false);
  const voiceBufferRef = useRef<string>('');
  const fullVoiceRef = useRef<string>('');
  /** 已處理過的 SpeechRecognition result 索引，避免 onresult 重複累積或漏段 */
  const voiceResultsProcessedRef = useRef(0);
  const langSwitchRef = useRef(false);

  const speechLangRef = useRef<SpeechLang>('zh-TW');
  const [speechLang, setSpeechLang] = useState<SpeechLang>('zh-TW');

  useEffect(() => {
    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const API_BASE_URL = getApiBaseUrl();
        console.log('[DB] API_BASE_URL =', API_BASE_URL);

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

  // 注意：不再因生命徵象變化自動改寫主訴，避免多次統整後語意飄移。
  // 主訴改寫只在「一鍵統整」與「語音結束」明確事件觸發。

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

        // 立即保留原始口述，避免生命徵象修正後遺失語音主訴
        appendPreservedTextSource(currentVoiceText);

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

    let textForIntegrate = isStaleAutoSummary(inputText) ? '' : inputText;
    if (!textForIntegrate.trim()) {
      textForIntegrate = resolveTextSourceForIntegrate();
    }
    console.log('[INTEGRATE] 統整當前主訴內容:', textForIntegrate);
    void runLlmSummarizeAndRecommend(textForIntegrate.trim() ? textForIntegrate : undefined);
  };

  const [recommendedSymptoms, setRecommendedSymptoms] = useState<string[]>([]);
  // LLM 事先為外傷 / 非外傷各自計算好的推薦症狀，切換 Tab 時直接使用
  const [llmTraumaSymptoms, setLlmTraumaSymptoms] = useState<string[] | null>(null);
  const [llmNonTraumaSymptoms, setLlmNonTraumaSymptoms] = useState<string[] | null>(null);

  // 顯示推薦症狀前一律即時過濾掉「目前已選」的項目；
  // 避免按完一鍵統整後選了一個症狀，又因為輸入框變動而把它再次秀出來。
  // 已選 set 隨時會變，所以這層過濾不能在快照存入時做、必須在顯示時做。
  const filterOutSelectedSymptoms = (list: string[] | null | undefined): string[] => {
    if (!list || !list.length) return [];
    const picked = new Set(
      Array.from(selectedSymptoms).map(s =>
        s.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '')
      )
    );
    return list.filter(name => !picked.has(name));
  };
  const [isLlmIntegrating, setIsLlmIntegrating] = useState<boolean>(false);
  const [lastLlmSummary, setLastLlmSummary] = useState<string>('');
  const [recommendationSource, setRecommendationSource] = useState<'llm' | 'fallback' | 'none'>('none');
  const lastIntegrateSignatureRef = useRef<string>('');
  const lastLlmSummaryRef = useRef<string>('');
  const lastIntegrateVitalsSignatureRef = useRef<string>('');
  // 保留使用者原始口述／手動輸入（非 LLM 統整結果），生命徵象修正後可重新合併
  const preservedTextSourceRef = useRef<string>('');
  const integrateRequestIdRef = useRef(0);
  const prevVitalsSignatureRef = useRef<string>('');
  /** 發表模式：命中預設情境時保存，供症狀/規則保底使用 */
  const activePresentationScenarioRef = useRef<PresentationScenario | null>(null);

  const vitalsSignature = useMemo(() => JSON.stringify(vitals ?? {}), [vitals]);

  const appendPreservedTextSource = (text: string) => {
    const t = (text || '').trim();
    if (!t) return;
    const prev = preservedTextSourceRef.current.trim();
    if (prev && (prev === t || prev.includes(t))) return;
    preservedTextSourceRef.current = prev ? `${prev}；${t}` : t;
  };

  const vitalsChangedSinceLastIntegrate = (): boolean =>
    Boolean(
      lastIntegrateVitalsSignatureRef.current &&
      vitalsSignature !== lastIntegrateVitalsSignatureRef.current
    );

  const isStaleAutoSummary = (text: string): boolean => {
    const t = (text || '').trim();
    const last = lastLlmSummaryRef.current.trim();
    if (!last) return false;
    if (!t) return vitalsChangedSinceLastIntegrate();
    if (t === last) return true;
    if (!vitalsChangedSinceLastIntegrate()) return false;
    return last.split('、').some(part => {
      const p = part.trim();
      return p.length > 0 && t.includes(p);
    });
  };

  const clearIntegrateArtifacts = () => {
    setLastLlmSummary('');
    lastLlmSummaryRef.current = '';
    lastIntegrateVitalsSignatureRef.current = '';
    setLlmTraumaSymptoms(null);
    setLlmNonTraumaSymptoms(null);
    setRecommendationSource('none');
    setRecommendedSymptoms([]);
    lastIntegrateSignatureRef.current = '';
    activePresentationScenarioRef.current = null;
  };

  // 生命徵象變更後：上次自動統整的主訴與推薦一律失效
  useEffect(() => {
    if (prevVitalsSignatureRef.current === vitalsSignature) return;
    const isFirstMount = prevVitalsSignatureRef.current === '';
    prevVitalsSignatureRef.current = vitalsSignature;
    lastIntegrateSignatureRef.current = '';
    if (isFirstMount) return;

    const autoSummary = lastLlmSummaryRef.current.trim();
    if (!autoSummary) return;

    const current = inputText.trim();
    const hasStalePart =
      !current ||
      current === autoSummary ||
      autoSummary.split('、').some(part => {
        const p = part.trim();
        return p.length > 0 && current.includes(p);
      });

    if (hasStalePart) {
      setInputText('');
      clearIntegrateArtifacts();
    }
  }, [vitalsSignature, inputText]);
  const [isSupplementOpen, setIsSupplementOpen] = useState<boolean>(false);
  const [supplementText, setSupplementText] = useState<string>('');

  const getSupplementVoiceSource = (): string => {
    const lines = supplementText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    return lines.join('；');
  };

  const resolveTextSourceForIntegrate = (): string =>
    preservedTextSourceRef.current.trim() || getSupplementVoiceSource();

  const [aiHighlights, setAiHighlights] = useState<Record<AiHighlightKey, boolean>>({
    chief: false,
    symptoms: false,
    rules: false,
  });
  const aiHighlightTimersRef = useRef<Partial<Record<AiHighlightKey, ReturnType<typeof setTimeout>>>>({});
  const symptomsFlashDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashAiHighlight = (key: AiHighlightKey) => {
    const prev = aiHighlightTimersRef.current[key];
    if (prev) clearTimeout(prev);
    setAiHighlights(h => ({ ...h, [key]: false }));
    requestAnimationFrame(() => {
      setAiHighlights(h => ({ ...h, [key]: true }));
      aiHighlightTimersRef.current[key] = setTimeout(() => {
        setAiHighlights(h => ({ ...h, [key]: false }));
        delete aiHighlightTimersRef.current[key];
      }, AI_HIGHLIGHT_MS);
    });
  };

  useEffect(() => {
    const timers = aiHighlightTimersRef.current;
    return () => {
      Object.values(timers).forEach(t => t && clearTimeout(t));
      if (symptomsFlashDelayRef.current) clearTimeout(symptomsFlashDelayRef.current);
    };
  }, []);

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
        setRecommendedSymptoms(filterOutSelectedSymptoms(llmTraumaSymptoms));
        return;
      }
      setRecommendedSymptoms(filterOutSelectedSymptoms(llmNonTraumaSymptoms));
      return;
    }

    // 只要主訴被手動修改（不等於上次 LLM summary），就即時重跑關鍵字推薦
    searchSymptoms(trimmed);
    // selectedSymptoms 加進依賴：選/取消選時自動 re-filter 推薦顯示
  }, [activeTab, inputText, llmTraumaSymptoms, llmNonTraumaSymptoms, isLlmIntegrating, lastLlmSummary, recommendationSource, selectedSymptoms]);

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

  const normalizeForRecommend = (text: string): string => {
    return text.replace(/[、，,\s]+$/g, '').trim();
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

  // 外傷機轉但 LLM 未推薦 T 類時，依受傷部位從 TTAS 外傷症狀補候選
  const getTraumaMechanismFallback = (summary: string): string[] => {
    if (!triageRows || !hasTraumaMechanism(summary)) {
      return getSafeFallbackByTab(summary, 't');
    }

    const regionHints: string[] = [];
    if (/脚|腳|腿|小腿|大腿|足|踝|膝/.test(summary)) regionHints.push('下肢');
    if (/手|臂|腕|肘|肩/.test(summary)) regionHints.push('上肢');
    if (/頭|头|腦/.test(summary)) regionHints.push('頭');
    if (/胸|肋/.test(summary)) regionHints.push('胸');
    if (/腹|骨盆|臀|屁股/.test(summary)) regionHints.push('腹');

    const seen = new Set<string>();
    const results: string[] = [];
    const picked = new Set(
      Array.from(selectedSymptoms).map(s =>
        s.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '')
      )
    );

    const tryAdd = (symptom: string) => {
      if (seen.has(symptom) || picked.has(symptom)) return;
      seen.add(symptom);
      results.push(symptom);
    };

    const traumaPattern = /鈍傷|钝伤|撕裂|擦傷|擦伤|扭傷|扭伤|穿刺|截肢|骨折/;

    for (const row of triageRows) {
      const code = row.system_code || '';
      if (!code.startsWith('T') && !code.startsWith('E')) continue;
      const name = row.symptom_name;
      if (regionHints.length > 0 && !regionHints.some(h => name.includes(h))) continue;
      if (!traumaPattern.test(name)) continue;
      tryAdd(name);
      if (results.length >= 5) break;
    }

    if (results.length > 0) return results;
    return getSafeFallbackByTab(summary, 't');
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

    // Phase 2：不再用 substring 分數預先剔除候選。
    // 候選縮減交給後端 rag_pipeline.find_similar_symptoms（語意檢索）處理，
    // 避免「意識改變」這種跟 TTAS 標準名「意識程度改變」字面不完全相同的詞被誤殺。
    const candidates = Array.from(candidateSet);

    console.log('[LLM] unified recommendation');
    console.log('[LLM] summary =', summary);
    console.log('[LLM] candidates count =', candidates.length, '(send full list to backend for semantic narrowing)');

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

      // Phase 2：後端已用 RAG 語意檢索 + LLM 過一輪了，前端只負責「去重 + 過濾已選過」。
      // 不再用 isSymptomRelevantToTerms 這種 substring 過濾，
      // 否則「意識程度改變」這類語意相關但字面不重疊的症狀會被誤殺。
      const filtered = list.filter((name, index, arr) => {
        const isFirst = arr.indexOf(name) === index;
        if (!isFirst) return false;
        const already = Array.from(selectedSymptoms).some(selected => {
          const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
          return cleanSelected === name;
        });
        return !already;
      }).slice(0, 5);

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

      if (!newVoice) {
        source = resolveTextSourceForIntegrate();
      } else {
      // 檢查新語音是否已經在現有主訴中（空字串不可視為「已處理過」）
      const isAlreadyProcessed = currentInput.includes(newVoice) ||
        newVoice.split(/[、，,]/).some(part => {
          const p = part.trim();
          return p.length > 0 && currentInput.includes(p);
        });

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
    }
    else if (fullVoiceRef.current) {
      source = fullVoiceRef.current.trim();
    } else {
      const resolved = resolveTextSourceForIntegrate();
      source = resolved || inputText.trim();
    }

    if (isStaleAutoSummary(source)) {
      console.log('[LLM] 偵測到過期自動統整主訴，改回原始口述來源');
      source = resolveTextSourceForIntegrate();
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
        if (key === 'respRate') {
          const rr = parseFloat(value);
          return !isNaN(rr) && (rr > 20 || rr < 12);
        }
      }
      return false;
    });

    // 如果沒有文字輸入也沒有異常生命徵象，清除上次統整殘留後結束
    if (!source && !hasAbnormalVitals) {
      if (lastLlmSummaryRef.current.trim() || recommendationSource !== 'none') {
        setInputText('');
        clearIntegrateArtifacts();
      }
      console.log('[CC] 沒有文字輸入也沒有異常生命徵象，已清除舊統整結果');
      return;
    }

    console.log('[CC] runLlmSummarizeAndRecommend activeTab =', activeTab, 'source =', source, 'hasAbnormalVitals =', hasAbnormalVitals);

    if (symptomsFlashDelayRef.current) {
      clearTimeout(symptomsFlashDelayRef.current);
      symptomsFlashDelayRef.current = null;
    }

    setIsLlmIntegrating(true);
    const requestId = ++integrateRequestIdRef.current;
    try {
      const integrateSignature = `${normalizeForRecommend(source)}::${llmMode}::${vitalsSignature}`;

      if (source) {
        preservedTextSourceRef.current = source;
      }

      const presentationScenario = detectPresentationScenario(source || '');
      if (presentationScenario) {
        activePresentationScenarioRef.current = presentationScenario;
        console.log('[PRESENTATION] 命中展示情境:', presentationScenario.id);

        // 展示模式：補充資料保留完整口述（語音逐字稿），主訴欄位才顯示統整結果
        if (source.trim()) {
          preservedTextSourceRef.current = source.trim();
          setSupplementText(prev => {
            const src = source.trim();
            if (!prev) return src;
            if (prev.includes(src)) return prev;
            if (src.includes(prev)) return src;
            return `${prev}\n${src}`;
          });
        }

        await sleep(presentationScenario.summarizeDelayMs);
        if (requestId !== integrateRequestIdRef.current) {
          console.log('[PRESENTATION] 略過過期的展示結果');
          return;
        }

        const summary = presentationScenario.summary;
        setLastLlmSummary(summary);
        lastLlmSummaryRef.current = summary;
        setInputText(summary);
        lastIntegrateSignatureRef.current = integrateSignature;
        lastIntegrateVitalsSignatureRef.current = vitalsSignature;
        setActiveTab(presentationScenario.activeTab);

        flashAiHighlight('chief');

        const picked = new Set(
          Array.from(selectedSymptoms).map(s =>
            s.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '')
          )
        );
        const symptomList = buildPresentationSymptomList(presentationScenario, picked);

        // 主訴已出現；推薦症狀區維持「分析中」直到下方延遲結束
        await sleep(presentationScenario.symptomsDelayAfterSummaryMs);
        if (requestId !== integrateRequestIdRef.current) {
          console.log('[PRESENTATION] 略過過期的推薦症狀結果');
          return;
        }

        if (presentationScenario.activeTab === 't') {
          setLlmTraumaSymptoms(symptomList);
          setLlmNonTraumaSymptoms([]);
        } else {
          setLlmTraumaSymptoms([]);
          setLlmNonTraumaSymptoms(symptomList);
        }
        setRecommendationSource('llm');
        setRecommendedSymptoms(symptomList);

        flashAiHighlight('symptoms');

        return;
      }

      activePresentationScenarioRef.current = null;

      const summary = (await summarizeChiefComplaint(source)).trim();
      if (requestId !== integrateRequestIdRef.current) {
        console.log('[LLM] 略過過期的統整結果（已有較新的請求）');
        return;
      }

      setLastLlmSummary(summary);
      lastLlmSummaryRef.current = summary;
      setInputText(summary);
      lastIntegrateSignatureRef.current = integrateSignature;
      lastIntegrateVitalsSignatureRef.current = vitalsSignature;

      const traumaMechanism = hasTraumaMechanism(summary);
      if (traumaMechanism) {
        setActiveTab('t');
        console.log('[CC] 偵測外傷機轉，切換至 T 外傷 Tab');
      }

      // 主訴整理完成後先閃 2 下，再進行推薦症狀 API
      flashAiHighlight('chief');
      const chiefFlashEndsAt = Date.now() + AI_HIGHLIGHT_MS;

      // 真正 unified RAG：一次檢索 + 一次推薦，再前端分類
      // Phase 2：信任後端 RAG/LLM 已挑好的結果，前端不再做 substring 性質的相關性過濾或強制注入。
      const unifiedList = (await requestUnifiedRecommendations(summary)) ?? [];
      if (requestId !== integrateRequestIdRef.current) {
        console.log('[LLM] 略過過期的推薦結果（已有較新的請求）');
        return;
      }
      console.log('[LLM] unified recommendations from backend =', unifiedList);
      const split = splitRecommendationsByTab(unifiedList);
      const llmHasResult = split.trauma.length > 0 || split.nonTrauma.length > 0;
      const traumaList = split.trauma.length
        ? split.trauma
        : (hasTraumaMechanism(summary) ? getTraumaMechanismFallback(summary) : getSafeFallbackByTab(summary, 't'));
      const nonTraumaList = split.nonTrauma.length ? split.nonTrauma : getSafeFallbackByTab(summary, 'a');
      const picked = new Set(
        Array.from(selectedSymptoms).map(s =>
          s.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '')
        )
      );
      const filteredTrauma = traumaList.filter(name => !picked.has(name));
      const filteredNonTrauma = nonTraumaList.filter(name => !picked.has(name));

      setLlmTraumaSymptoms(filteredTrauma);
      setLlmNonTraumaSymptoms(filteredNonTrauma);
      setRecommendationSource(
        llmHasResult
          ? 'llm'
          : (filteredTrauma.length || filteredNonTrauma.length ? 'fallback' : 'none')
      );
      console.log(
        '[LLM] recommendation source =',
        llmHasResult
          ? 'llm'
          : (filteredTrauma.length || filteredNonTrauma.length ? 'fallback' : 'none')
      );

      // 一鍵統整後只顯示 LLM 結果，不回退關鍵字推薦
      if (traumaMechanism || activeTab === 't') {
        setRecommendedSymptoms(filteredTrauma);
      } else {
        setRecommendedSymptoms(filteredNonTrauma);
      }
      // 推薦症狀完成後再閃 2 下（等主訴高亮結束，避免兩區同時閃）
      const shouldFlashSymptoms =
        llmHasResult && (filteredTrauma.length > 0 || filteredNonTrauma.length > 0);
      if (shouldFlashSymptoms) {
        const delayMs = Math.max(0, chiefFlashEndsAt - Date.now());
        symptomsFlashDelayRef.current = setTimeout(() => {
          symptomsFlashDelayRef.current = null;
          flashAiHighlight('symptoms');
        }, delayMs);
      }
    } finally {
      setIsLlmIntegrating(false);
    }

    // 清空語音緩衝
    fullVoiceRef.current = '';
  };

  // 手動編輯主訴：不自動呼叫 LLM，僅等待「一鍵統整」時觸發統整與重跑。

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

    if (text.trim() !== lastLlmSummaryRef.current.trim()) {
      lastIntegrateSignatureRef.current = '';
      if (!text.trim()) {
        preservedTextSourceRef.current = '';
        clearIntegrateArtifacts();
      } else if (!isStaleAutoSummary(text)) {
        // 使用者手動輸入的新主訴，生命徵象修正後仍應保留
        preservedTextSourceRef.current = text.trim();
      }
    }

    // 不立即把 recommendationSource 清空，避免輸入中的排序抖動
    // 若目前已有 LLM 結果，輸入中先維持 LLM 顯示，避免順序抖動。
    // 但必須依目前已選即時過濾，否則使用者選過的症狀又會跳回推薦欄。
    if (recommendationSource !== 'none') {
      if (activeTab === 't') {
        setRecommendedSymptoms(filterOutSelectedSymptoms(llmTraumaSymptoms));
      } else {
        setRecommendedSymptoms(filterOutSelectedSymptoms(llmNonTraumaSymptoms));
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
      alert('此瀏覽器不支援語音輸入。iPad 請用 Safari 並以 https:// 開啟（區域網路需 HTTPS 才能使用麥克風）。');
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
      voiceResultsProcessedRef.current = 0;
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
      // 只處理「尚未處理過」的 final results，避免重複累積或只取最後一段而漏掉前面
      let newText = '';
      for (let i = voiceResultsProcessedRef.current; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const raw = (event.results[i][0].transcript as string) || '';
        if (!raw.trim()) continue;
        const transcript =
          speechLangRef.current === 'zh-TW' ? toTaiwanTraditional(raw) : raw;
        newText += (newText ? ' ' : '') + transcript.trim();
        voiceResultsProcessedRef.current = i + 1;
      }
      if (!newText) return;

      const base = voiceBufferRef.current || '';
      voiceBufferRef.current = base
        ? `${base}${base.endsWith('\n') ? '' : '\n'}${newText}`
        : newText;
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
      alert('此瀏覽器不支援語音輸入。iPad 請用 Safari 並以 https:// 開啟（區域網路需 HTTPS 才能使用麥克風）。');
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
    voiceResultsProcessedRef.current = 0;
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
  const [recommendedRules, setRecommendedRules] = useState<RecommendedRuleItem[]>([]);
  const [isRecommendRulesLoading, setIsRecommendRulesLoading] = useState(false);

  const getRulesPrefetchContext = () => ({
    chiefComplaint: inputText || '',
    vitalsSignature,
    llmMode,
  });

  /** 只保留下方 TTAS 列表也會顯示的 rule_code（與 symptomCriteriaIndex 一致） */
  const filterRulesToCriteriaIndex = (
    rules: RecommendedRuleItem[],
    selectedSymptomNames: string[]
  ): RecommendedRuleItem[] => {
    const allowed = new Set<string>();
    for (const symptom of selectedSymptomNames) {
      for (const item of symptomCriteriaIndex.get(symptom) ?? []) {
        allowed.add(item.rule_code);
      }
    }
    if (!allowed.size) return rules;
    return rules.filter(rule => allowed.has(rule.rule_code));
  };

  const normalizeRecommendRulesResponse = (data: unknown): RecommendedRuleItem[] => {
    const raw = (data as { recommended_rules?: unknown })?.recommended_rules;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((rule: unknown) =>
        rule &&
        typeof (rule as RecommendedRuleItem).rule_code === 'string' &&
        typeof (rule as RecommendedRuleItem).symptom_name === 'string' &&
        typeof (rule as RecommendedRuleItem).judge_name === 'string' &&
        Number.isFinite(Number((rule as RecommendedRuleItem).ttas_degree))
      )
      .map((rule: unknown) => ({
        rule_code: (rule as RecommendedRuleItem).rule_code,
        symptom_name: (rule as RecommendedRuleItem).symptom_name,
        judge_name: (rule as RecommendedRuleItem).judge_name,
        ttas_degree: Number((rule as RecommendedRuleItem).ttas_degree),
      }));
  };

  const fetchRecommendRulesFromApi = async (
    symptomNames: string[],
    context?: ReturnType<typeof getRulesPrefetchContext>
  ): Promise<RecommendedRuleItem[]> => {
    if (!symptomNames.length) return [];
    const ctx = context ?? getRulesPrefetchContext();

    const presentationScenario = activePresentationScenarioRef.current;
    const hasPresentationRuleTarget =
      presentationScenario &&
      symptomNames.some(name =>
        presentationScenario.ruleTargets.some(target => target.symptomName === name)
      );
    if (hasPresentationRuleTarget && presentationScenario && triageRows) {
      await sleep(presentationScenario.rulesDelayMs);
      return filterRulesToCriteriaIndex(
        buildPresentationRules(
          presentationScenario,
          symptomNames,
          triageRows,
          age
        ),
        symptomNames
      );
    }

    const res = await fetch(`${LLM_BASE_URL}/api/recommend-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_symptoms: symptomNames,
        chief_complaint: ctx.chiefComplaint,
        vitals: vitals || {},
        llm_mode: ctx.llmMode,
        age: age ?? null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return filterRulesToCriteriaIndex(
      normalizeRecommendRulesResponse(data),
      symptomNames
    );
  };

  // 點選症狀後才請求推薦判斷規則（不做背景預取，避免 Ollama 排隊多筆 LLM）
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
        console.log('[RULES] 依已選症狀請求規則:', selectedSymptomNames);
        const rules = await fetchRecommendRulesFromApi(selectedSymptomNames);
        if (cancelled) return;
        setRecommendedRules(rules);
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
  }, [symptomTags, vitalsSignature, inputText, llmMode, age, LLM_BASE_URL]);

  const wasRecommendRulesLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = wasRecommendRulesLoadingRef.current;
    wasRecommendRulesLoadingRef.current = isRecommendRulesLoading;
    if (wasLoading && !isRecommendRulesLoading && recommendedRules.length > 0) {
      flashAiHighlight('rules');
    }
  }, [isRecommendRulesLoading, recommendedRules.length]);

  useEffect(() => {
    // 根據當前已選症狀，自動處理部分規則：
    // 1) 移除已不在 symptomTags 中的規則
    // 2) 若「心跳停止」只對應一條判斷依據，則自動帶入
    if (pendingSessionRestoreRef.current && !sessionRestoreRulesAppliedRef.current) {
      return;
    }

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

  useEffect(() => {
    if (!sessionRestore) return;
    pendingSessionRestoreRef.current = sessionRestore;
    sessionRestoreRulesAppliedRef.current = false;
    if (sessionRestore.recommendedSymptoms.length > 0) {
      setRecommendedSymptoms(sessionRestore.recommendedSymptoms);
    }
    setSupplementText(sessionRestore.supplementText || '');
  }, [sessionRestore?.token]);

  useEffect(() => {
    const restoreKey = sessionRestore?.token ?? restoredSelectedRulesKey ?? null;
    const pending = pendingSessionRestoreRef.current;
    if (!restoreKey) return;
    if (lastAppliedRestoreKeyRef.current === restoreKey && sessionRestoreRulesAppliedRef.current) return;

    const rulesFromPending = pending?.selectedRules;
    const rulesFromProp =
      restoredSelectedRules && Object.keys(restoredSelectedRules).length > 0
        ? restoredSelectedRules
        : null;
    const rulesToApply = rulesFromPending ?? rulesFromProp;
    const hasRulesToRestore = Boolean(rulesToApply && Object.keys(rulesToApply).length > 0);

    if (hasRulesToRestore && !triageRows?.length) return;

    if (hasRulesToRestore && rulesToApply) {
      setSelectedRules(rulesToApply);
    }

    sessionRestoreRulesAppliedRef.current = true;
    lastAppliedRestoreKeyRef.current = restoreKey;
    pendingSessionRestoreRef.current = null;
    onSessionRestoreApplied?.();
  }, [
    triageRows,
    sessionRestore?.token,
    restoredSelectedRules,
    restoredSelectedRulesKey,
    onSessionRestoreApplied,
  ]);

  const worstSelectedDegree = useMemo(() => {
    const degrees = Object.values(selectedRules).map(r => r.degree);
    if (degrees.length === 0) return null;
    return Math.min(...degrees);
  }, [selectedRules]);

  const recommendedRulesBySymptom = useMemo(() => {
    const grouped = new Map<string, typeof recommendedRules>();
    for (const rule of recommendedRules) {
      const key = rule.symptom_name;
      const list = grouped.get(key) ?? [];
      list.push(rule);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries()).map(([symptom, rules]) => [
      symptom,
      [...rules].sort((a, b) => Number(a.ttas_degree) - Number(b.ttas_degree)),
    ] as const);
  }, [recommendedRules]);

  useEffect(() => {
    if (onWorstDegreeChange) {
      onWorstDegreeChange(worstSelectedDegree);
    }
  }, [worstSelectedDegree, onWorstDegreeChange]);

  const getRuleColors = (degree: number) => {
    switch (degree) {
      case 1:
        return { border: 'border-red-500', bg: 'bg-red-500/30 hover:bg-red-500/40', text: 'text-red-600' };
      case 2:
        return { border: 'border-orange-500', bg: 'bg-orange-500/30 hover:bg-orange-500/40', text: 'text-orange-600' };
      case 3:
        return { border: 'border-yellow-500', bg: 'bg-yellow-500/30 hover:bg-yellow-500/40', text: 'text-yellow-600' };
      case 4:
        return { border: 'border-green-500', bg: 'bg-green-500/30 hover:bg-green-500/40', text: 'text-green-600' };
      case 5:
      default:
        return { border: 'border-blue-500', bg: 'bg-blue-500/30 hover:bg-blue-500/40', text: 'text-blue-600' };
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

  const chiefComplaintApi: ChiefComplaintContextApi = {
    triageError,
    activeTab,
    setActiveTab,
    age,
    isSymptomSelectedByLabel,
    setSelectedSymptoms,
    inputText,
    handleInputChange,
    handleKeyDown,
    isListening,
    handleOneClickIntegrate,
    isLlmIntegrating,
    handleVoiceInputClick,
    voiceConsented,
    isSupplementOpen,
    setIsSupplementOpen,
    supplementText,
    setSupplementText,
    speechLang,
    setSpeechLang,
    speechLangRef,
    recognitionRef,
    langSwitchRef,
    recommendedSymptoms,
    addRecommendedSymptom,
    symptomTags,
    removeSymptom,
    isRecommendRulesLoading,
    recommendedRules,
    recommendedRulesBySymptom,
    selectedRules,
    setSelectedRules,
    getRuleColors,
    worstSelectedDegree,
    chiefComplaintAiHighlight: aiHighlights.chief,
    recommendSymptomsAiHighlight: aiHighlights.symptoms,
    aiRulesAiHighlight: aiHighlights.rules,
  };

  return (
    <ChiefComplaintContext.Provider value={chiefComplaintApi}>
      {children}
    </ChiefComplaintContext.Provider>
  );
};

export const ChiefComplaintMainPanel: React.FC = () => {
  const c = useChiefComplaintApi();
  return (
    <div className="bg-content-light dark:bg-content-dark p-4 rounded-2xl shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold flex items-center gap-2">主訴</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              c.setSelectedSymptoms(prev => {
                const label = '心跳停止';
                const alreadyHas = Array.from(prev).some(selected => {
                  const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
                  return cleanSelected === label;
                });
                if (alreadyHas) return prev;
                return new Set([...prev, `manual:${label}`]);
              })
            }
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${c.isSymptomSelectedByLabel('心跳停止') ? 'selected' : ''
              }`}
          >
            <span className="material-symbols-outlined text-sm">cardiology</span>
            <span>心跳停止</span>
          </button>
        </div>
      </div>
      {c.triageError && (
        <div className="mb-2 text-xs text-red-500">
          {c.triageError}
        </div>
      )}

      <div className="relative mb-3">
        <div className="flex gap-2 items-stretch">
          <div
            className={`flex-1 min-w-0 rounded-lg border border-content-light dark:border-subtext-dark overflow-hidden ${c.chiefComplaintAiHighlight ? 'ai-result-highlight' : ''}`}
          >
            <textarea
              className="form-textarea w-full min-h-[72px] rounded-lg border-0 bg-white dark:bg-background-dark p-3 pr-32 focus:ring-primary focus:border-primary resize-none"
              id="symptoms-detail"
              placeholder="請輸入患者主訴症狀，系統會根據所有關鍵字持續推薦相關症狀（如：患者主訴頭痛，昨天開始胸悶...）"
              value={c.inputText}
              onChange={c.handleInputChange}
              onKeyDown={c.handleKeyDown}
              disabled={c.isListening}
            />
          </div>
          <button
            onClick={c.handleOneClickIntegrate}
            disabled={c.isLlmIntegrating}
            className={`shrink-0 self-stretch px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors text-sm font-medium whitespace-nowrap flex items-center justify-center gap-1.5 ${c.isLlmIntegrating
                ? 'bg-primary/70 text-white cursor-wait'
                : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            title="統整主訴與生命徵象"
          >
            {c.isLlmIntegrating && (
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
            )}
            {c.isLlmIntegrating ? '統整中...' : '一鍵統整'}
          </button>
        </div>
        <button
          type="button"
          onClick={c.handleVoiceInputClick}
          disabled={!c.voiceConsented}
          className={`absolute bottom-2 right-[calc(9rem-5px)] flex items-center justify-center size-9 rounded-full text-white transition-all duration-200 shadow-md ${!c.voiceConsented
            ? 'bg-gray-400 cursor-not-allowed opacity-50'
            : c.isListening
              ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/50 animate-pulse'
              : 'bg-primary hover:bg-primary/90'
            }`}
          title={!c.voiceConsented ? "請先同意語音同意書才能使用語音功能" : ""}
        >
          <span className="material-symbols-outlined">{c.isListening ? 'stop_circle' : 'mic'}</span>
        </button>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => c.setIsSupplementOpen(prev => !prev)}
            className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
          >
            <span className="material-symbols-outlined text-sm">
              {c.isSupplementOpen ? 'expand_less' : 'expand_more'}
            </span>
            <span>補充資料</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-subtext-light dark:text-subtext-dark">
            <span className="material-symbols-outlined text-base">translate</span>
            <button
              type="button"
              onClick={() => {
                if (c.speechLangRef.current === 'zh-TW') {
                  c.setSpeechLang('zh-TW');
                  return;
                }
                c.speechLangRef.current = 'zh-TW';
                c.setSpeechLang('zh-TW');
                if (c.isListening && c.recognitionRef.current) {
                  try {
                    c.langSwitchRef.current = true;
                    c.recognitionRef.current.stop();
                  } catch {
                    // ignore
                  }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${c.speechLang === 'zh-TW'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
                }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => {
                if (c.speechLangRef.current === 'en-US') {
                  c.setSpeechLang('en-US');
                  return;
                }
                c.speechLangRef.current = 'en-US';
                c.setSpeechLang('en-US');
                if (c.isListening && c.recognitionRef.current) {
                  try {
                    c.langSwitchRef.current = true;
                    c.recognitionRef.current.stop();
                  } catch {
                    // ignore
                  }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${c.speechLang === 'en-US'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
                }`}
            >
              英語
            </button>
            <button
              type="button"
              onClick={() => {
                if (c.speechLangRef.current === 'ja-JP') {
                  c.setSpeechLang('ja-JP');
                  return;
                }
                c.speechLangRef.current = 'ja-JP';
                c.setSpeechLang('ja-JP');

                if (c.isListening && c.recognitionRef.current) {
                  try {
                    c.langSwitchRef.current = true;
                    c.recognitionRef.current.stop();
                  } catch { }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${c.speechLang === 'ja-JP'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
                }`}
            >
              日語
            </button>

            <button
              type="button"
              onClick={() => {
                if (c.speechLangRef.current === 'vi-VN') {
                  c.setSpeechLang('vi-VN');
                  return;
                }
                c.speechLangRef.current = 'vi-VN';
                c.setSpeechLang('vi-VN');

                if (c.isListening && c.recognitionRef.current) {
                  try {
                    c.langSwitchRef.current = true;
                    c.recognitionRef.current.stop();
                  } catch { }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${c.speechLang === 'vi-VN'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
                }`}
            >
              越南語 Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => {
                if (c.speechLangRef.current === 'id-ID') {
                  c.setSpeechLang('id-ID');
                  return;
                }
                c.speechLangRef.current = 'id-ID';
                c.setSpeechLang('id-ID');
                if (c.isListening && c.recognitionRef.current) {
                  try {
                    c.langSwitchRef.current = true;
                    c.recognitionRef.current.stop();
                  } catch { }
                }
              }}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${c.speechLang === 'id-ID'
                ? 'bg-primary text-white border-primary'
                : 'bg-transparent text-primary border-primary/40 hover:bg-primary/10'
                }`}
            >
              印尼語 Bahasa
            </button>
          </div>
        </div>
        {c.isSupplementOpen && (
          <div className="mt-2">
            <textarea
              className="form-textarea w-full min-h-[64px] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark p-2.5 focus:ring-primary focus:border-primary resize-none text-sm"
              placeholder="可輸入補充說明（例如：既往病史、用藥、家屬提供的額外資訊等）"
              value={c.supplementText}
              onChange={(e) => c.setSupplementText(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const ChiefComplaintRecommendationsPanel: React.FC = () => {
  const c = useChiefComplaintApi();
  return (
    <div className="bg-content-light dark:bg-content-dark p-4 rounded-2xl shadow-lg flex flex-col shrink-0 min-h-[600px]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1.5 bg-background-light dark:bg-background-dark/60 px-2 py-1.5 rounded-2xl border border-primary/30">
          <button
            type="button"
            onClick={() => c.setActiveTab('a')}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors sm:px-5 sm:py-2 sm:text-base ${c.activeTab === 'a'
              ? 'bg-primary text-white'
              : 'bg-transparent text-primary hover:bg-primary/10'
              }`}
          >
            {(c.age !== undefined ? (c.age >= 18 ? 'A' : 'P') : 'A')} 非外傷
          </button>
          <button
            type="button"
            onClick={() => c.setActiveTab('t')}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors sm:px-5 sm:py-2 sm:text-base ${c.activeTab === 't'
              ? 'bg-primary text-white'
              : 'bg-transparent text-primary hover:bg-primary/10'
              }`}
          >
            T 外傷
          </button>
        </div>
      </div>
      <div
        className={`mb-3 p-3 bg-primary/5 rounded-lg border border-primary/20 ${c.recommendSymptomsAiHighlight ? 'ai-result-highlight' : ''}`}
      >
        <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
          <span>推薦症狀</span>
          {c.isLlmIntegrating && (
            <>
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
              <span className="text-[10px] text-subtext-light dark:text-subtext-dark">分析中...</span>
            </>
          )}
        </h4>
        {c.isLlmIntegrating || c.recommendedSymptoms.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {c.recommendedSymptoms.map(symptom => (
              <button
                key={symptom}
                onClick={() => c.addRecommendedSymptom(symptom)}
                className="px-3 py-1 text-sm bg-white border border-primary/30 text-primary rounded-full hover:bg-primary/10 transition-colors"
              >
                + {symptom}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-subtext-light dark:text-subtext-dark py-2 text-center rounded-md border border-dashed border-primary/20">
            尚無推薦症狀；輸入主訴或點「一鍵統整」後將顯示於此。
          </p>
        )}
      </div>

      {c.symptomTags.length > 0 && (
        <div className="mb-3">
          <h4 className="text-base font-semibold mb-2">已選症狀</h4>
          <div className="flex flex-wrap gap-2">
            {c.symptomTags.map(({ display }) => (
              <div
                key={display}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-sm rounded-full max-w-full"
              >
                <span className="truncate max-w-[10rem]" title={display}>{display}</span>
                <button
                  onClick={() => c.removeSymptom(display)}
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

      <div className="mb-3">
        <h4 className="text-base font-semibold mb-2">判斷規則</h4>
        {c.symptomTags.length === 0 ? (
          <p className="text-xs text-subtext-light dark:text-subtext-dark py-2 px-2 rounded-md border border-dashed border-gray-200 dark:border-gray-700">
            選擇症狀後將顯示 TTAS 判斷規則與 AI 推薦判斷規則。
          </p>
        ) : (
          <>
            {(c.isRecommendRulesLoading || c.recommendedRules.length > 0) && (
              <div className="mb-3 pb-3 border-b border-dashed border-primary/40 relative overflow-visible">
                {c.aiRulesAiHighlight && (
                  <div className="ai-result-highlight-ring" aria-hidden />
                )}
                <div className="relative z-[1]">
                  <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-2">
                    <span>AI 推薦判斷規則</span>
                    {c.isRecommendRulesLoading && (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">sync</span>
                        <span className="text-[10px] text-subtext-light dark:text-subtext-dark">分析中...</span>
                      </>
                    )}
                  </div>
                  {c.recommendedRules.length > 0 && (
                    <div className="space-y-2 min-w-0">
                      {c.recommendedRulesBySymptom.map(([symptom, rules]) => (
                      <div key={`symptom-${symptom}`} className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-subtext-light dark:text-subtext-dark shrink-0">
                          {symptom}：
                        </span>
                        {(() => {
                          return rules.map(rule => {
                            const colors = c.getRuleColors(rule.ttas_degree);
                            const isSelected = !!c.selectedRules[rule.rule_code];
                            return (
                              <React.Fragment key={`${rule.symptom_name}__${rule.rule_code}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    c.setSelectedRules(prev => {
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
                                  className={`px-3 py-1.5 rounded-full border font-semibold text-xs leading-snug text-left max-w-full transition duration-200 ease-out transform ${colors.border} ${isSelected ? `${colors.bg.replace('30', '95')} text-white ring-2 ring-offset-1 ring-primary shadow-lg` : `${colors.bg} ${colors.text} hover:scale-105 active:scale-95`}`}
                                  title={`${rule.symptom_name}｜第${rule.ttas_degree}級：${rule.judge_name}`}
                                >
                                  第{rule.ttas_degree}級：{rule.judge_name}
                                </button>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {c.symptomTags.map(({ display, criteria }) => (
                criteria.length > 0 && (
                  <div key={display} className="space-y-1">
                    <div className="text-sm font-semibold text-subtext-light dark:text-subtext-dark">
                      {display}
                    </div>
                    {Array.from(
                      criteria.reduce((acc, item) => {
                        const list = acc.get(item.degree) ?? [];
                        list.push(item);
                        acc.set(item.degree, list);
                        return acc;
                      }, new Map<number, typeof criteria>())
                    )
                      .sort((a, b) => a[0] - b[0])
                      .map(([degree, items], idx) => {
                        const showSeparatorAbove = idx > 0;
                        return (
                          <React.Fragment key={`${display}-degree-${degree}`}>
                            {showSeparatorAbove && (
                              <div className="w-full border-t-2 border-dashed border-primary/80 dark:border-primary/60 my-3" aria-hidden />
                            )}
                            <div className="flex flex-wrap gap-2 min-w-0">
                              {items.map(item => {
                                const colors = c.getRuleColors(item.degree);
                                const isSelected = !!c.selectedRules[item.rule_code];
                                return (
                                  <React.Fragment key={item.rule_code}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        c.setSelectedRules(prev => {
                                          const next = { ...prev };
                                          const existing = prev[item.rule_code];

                                          Object.keys(next).forEach(ruleCode => {
                                            if (next[ruleCode].symptom_name === display) {
                                              delete next[ruleCode];
                                            }
                                          });

                                          if (existing) {
                                            return next;
                                          }

                                          next[item.rule_code] = {
                                            degree: item.degree,
                                            judge: item.judge,
                                            rule_code: item.rule_code,
                                            symptom_name: display,
                                          };

                                          return next;
                                        })
                                      }
                                      className={`px-3 py-1.5 rounded-full border font-semibold text-xs leading-snug text-left max-w-full transition duration-200 ease-out transform ${colors.border} ${isSelected ? `${colors.bg.replace('30', '95')} text-white ring-2 ring-offset-1 ring-primary shadow-lg` : `${colors.bg} ${colors.text} hover:scale-105 active:scale-95`}`}
                                      title={`第${item.degree}級：${item.judge}`}
                                    >
                                      第{item.degree}級：{item.judge}
                                    </button>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </React.Fragment>
                        );
                      })}
                  </div>
                )
              ))}
            </div>
            {c.worstSelectedDegree !== null && (
              <div className="mt-2 text-xs text-subtext-light dark:text-subtext-dark">
                所有已選判斷依據中最嚴重的級數：
                <span className="font-semibold">第{c.worstSelectedDegree}級</span>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-sm text-subtext-light dark:text-subtext-dark mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
        💡 系統會自動分析主訴中的所有關鍵字並持續推薦相關症狀，無論游標位置在哪裡。點擊症狀標籤的 ✕ 可移除。包含所有外傷、非外傷、環境症狀。
      </p>
    </div>
  );
};
