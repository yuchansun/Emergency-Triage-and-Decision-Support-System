import { useState, useCallback, useEffect } from 'react';
import './App.css';
import PatientInfo from './components/PatientInfo';
import LeftPanel from './components/LeftPanel';
import { ChiefComplaintProvider, ChiefComplaintRecommendationsPanel } from './components/ChiefComplaint';
import Login from "./components/Login";
import AddPatient from "./components/AddPatient";
import type { PatientData } from './components/AddPatient';
import SystemRecommendation from './components/SystemRecommendation';
import EmergencyTriageReport from './components/EmergencyTriageReport';
import HistoryPage from './components/HistoryPage';
import NursesPage from './components/NursesPage';
import StatsPage from './components/StatsPage';
import StaffProfile from './components/StaffProfile';
import { openVoiceConsentPopup } from './components/VoiceConsentModal';
import type { VitalsProps } from './components/Vitals';
<<<<<<< HEAD
import { getApiBaseUrl } from './config/serviceUrls';
=======
import { parsePastMedicalHistory } from './utils/parsePastMedicalHistory';
>>>>>>> main

type VitalsForm = NonNullable<VitalsProps['vitals']>;

const isDirectToERRecord = (record: {
  patient_source?: string;
  rule_code?: string;
  chief_complaint?: string;
}) => {
  const source = String(record.patient_source ?? '').trim();
  const chief = String(record.chief_complaint ?? '').trim();
  const ruleCodes = String(record.rule_code ?? '')
    .split(';')
    .map((code) => code.trim())
    .filter(Boolean);
  return (
    source === '直入急救室' ||
    chief === '直入急救室' ||
    ruleCodes.includes('R00000')
  );
};

const hasDirectErEditMissingFields = (vitals: VitalsForm) => {
  if (!vitals.drugAllergy) return true;
  const coreVitals = [
    vitals.temperature,
    vitals.heartRate,
    vitals.spo2,
    vitals.respRate,
    vitals.systolicBP,
    vitals.diastolicBP,
  ];
  return coreVitals.some((value) => !String(value ?? '').trim());
};

interface ToccState {
  travel: string;
  travelStart: string;
  travelEnd: string;
  occupation: string;
  occupationOther: string;
  contactItems: string[];
  clusterItems: string[];
  clusterOther: string;
  symptoms: string[];
}

function App() {
  const [stage, setStage] = useState<"login" | "addpatient" | "main" | "triageReport" | "history" | "nurses" | "stats" | "profile">(
    (localStorage.getItem("isLoggedIn") === "true") ? "addpatient" : "login"
  );

  const [currentUser, setCurrentUser] = useState<{ name: string; nurseId: string; role: string } | null>(
    localStorage.getItem("userData") ? JSON.parse(localStorage.getItem("userData")!) : null
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [llmMode, setLlmMode] = useState<'cloud' | 'local'>('local');
  const [historyKeyword, setHistoryKeyword] = useState<string>('');
  const [historySelectedId, setHistorySelectedId] = useState<string | null>(null);
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState(() => {
    const saved = localStorage.getItem("userSettings");

    return saved
      ? JSON.parse(saved)
      : {
        confirmBeforeSave: false,
      };
  });

  const [globalConfig, setGlobalConfig] = useState(() => {
    const saved = localStorage.getItem("globalConfig");

    return saved
      ? JSON.parse(saved)
      : {
        requireTOCC: false,
      };
  });

  const [voiceConsented, setVoiceConsented] = useState<boolean>(
    localStorage.getItem("voiceConsented") === "true"
  );

  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [triageActiveTab, setTriageActiveTab] = useState<'t' | 'a'>('a');
  const [inputText, setInputText] = useState<string>('');
  const [worstSelectedDegree, setWorstSelectedDegree] = useState<number | null>(null);
  const [forceLevel1, setForceLevel1] = useState<boolean>(false);
  const [directToERSelected, setDirectToERSelected] = useState<boolean>(false);
  const [editingDirectToER, setEditingDirectToER] = useState<boolean>(false);

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [bed, setBed] = useState<string>('');
  const [patientSource, setPatientSource] = useState<string>('');
  const [majorIncident, setMajorIncident] = useState<string>('');
  const [visitTime, setVisitTime] = useState<string>(new Date().toISOString());

  const getInitialVitals = (): VitalsForm => ({
    temperature: '', heartRate: '', spo2: '', respRate: '', weight: '',
    systolicBP: '', diastolicBP: '', bloodSugar: '', bloodSugarLevel: null,
    gcsEye: null, gcsVerbal: null, gcsMotor: null, obHistory: null,
    pastHistory: [], otherHistoryDetails: '', drugAllergy: null, painScore: null, doNotTreat: '', sentiment: null,
  });

  const getInitialTocc = (): ToccState => ({
    travel: "", travelStart: "", travelEnd: "", occupation: "", occupationOther: "",
    contactItems: [], clusterItems: [], clusterOther: "", symptoms: [],
  });

  const [vitals, setVitals] = useState<VitalsForm>(() => getInitialVitals());
  const [tocc, setTocc] = useState<ToccState>(getInitialTocc());

  const [chiefComplaintData, setChiefComplaintData] = useState({
    selectedRules: {} as Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }>,
    supplementText: '',
  });
  const [sessionRestore, setSessionRestore] = useState<{
    token: number;
    selectedRules: Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }>;
    recommendedSymptoms: string[];
    supplementText: string;
  } | null>(null);
  const [pendingHistoryRulesKey, setPendingHistoryRulesKey] = useState<number | null>(null);

  const isAdmin = (currentUser?.role || "").toLowerCase() === "admin";

  const handleSessionRestoreApplied = useCallback(() => {
    setSessionRestore(null);
  }, []);

  const restoreTriageFromHistoryRecord = useCallback(async (record: any) => {
    setEditingDirectToER(isDirectToERRecord(record));

    setPatientData({
      patient_id: record.patient_id,
      triage_id: record.triage_id,
      name: record.name,
      gender: record.gender === 'M' ? '男' : record.gender === 'F' ? '女' : '不詳',
      age: record.age,
      birthDate: record.birth_date,
      idNumber: record.id_number,
      medicalId: record.medical_id,
      drugAllergy: record.allergy,
      icCard: false,
    });

    setVitals({
      temperature: record.temperature?.toString() ?? '',
      heartRate: record.heart_rate?.toString() ?? '',
      spo2: record.spo2?.toString() ?? '',
      respRate: record.respiratory_rate?.toString() ?? '',
      weight: record.weight?.toString() ?? '',
      systolicBP: record.blood_pressure_sys?.toString() ?? '',
      diastolicBP: record.blood_pressure_dia?.toString() ?? '',
      bloodSugar: record.blood_sugar?.toString() ?? '',
      bloodSugarLevel: null,
      gcsEye: record.gcs_eye?.toString() ?? null,
      gcsVerbal: record.gcs_verbal?.toString() ?? null,
      gcsMotor: record.gcs_motor?.toString() ?? null,
      obHistory: null,
      pastHistory: parsePastMedicalHistory(record.past_medical_history).pastHistory,
      otherHistoryDetails: parsePastMedicalHistory(record.past_medical_history).otherHistoryDetails,
      drugAllergy: record.allergy ?? null,
      painScore: record.pain_score ?? null,
      doNotTreat: record.do_not_treat?.toString() ?? '',
      sentiment: record.sentiment ?? null,
    });

    setInputText(record.chief_complaint ?? '');

    setTocc({
      travel: record.tocc_travel ?? '',
      travelStart: record.tocc_travel_start ?? '',
      travelEnd: record.tocc_travel_end ?? '',
      occupation: record.tocc_occupation ?? '',
      occupationOther: record.tocc_occupation_other ?? '',
      contactItems: [],
      clusterItems: record.tocc_cluster_items ? record.tocc_cluster_items.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      clusterOther: record.tocc_cluster_other ?? '',
      symptoms: record.tocc_symptoms ? record.tocc_symptoms.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    });

    setVisitTime(record.visit_time ?? new Date().toISOString());
    setBed(record.bed ?? '');
    setPatientSource(record.patient_source ?? '');
    setMajorIncident(record.major_incident ?? '');

    const pairs = Array.isArray(record.symptom_rule_pairs) ? record.symptom_rule_pairs : [];
    const symptomKeys = new Set<string>();
    const recommendedSymptoms: string[] = [];
    const seenSymptoms = new Set<string>();
    for (const pair of pairs) {
      const name = String(pair?.symptom_name || '').trim();
      if (!name) continue;
      symptomKeys.add(`manual:${name}`);
      if (!seenSymptoms.has(name)) {
        seenSymptoms.add(name);
        recommendedSymptoms.push(name);
      }
    }
    setSelectedSymptoms(symptomKeys);

    const ruleCodes = String(record.rule_code || '')
      .split(';')
      .map((code: string) => code.trim())
      .filter(Boolean);

    const restoredRules: Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }> = {};
    if (ruleCodes.length > 0) {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${API_BASE_URL}/triage_hierarchy`);
        if (res.ok) {
          const rows = await res.json();
          for (const code of ruleCodes) {
            const row = (rows as Array<{ rule_code: string; judge_name: string; symptom_name: string; ttas_degree: string }>)
              .find((item) => item.rule_code === code);
            if (!row) continue;
            restoredRules[code] = {
              degree: Number(row.ttas_degree),
              judge: row.judge_name,
              rule_code: code,
              symptom_name: row.symptom_name,
            };
          }
        }
      } catch (err) {
        console.error('[HISTORY] restore selectedRules failed', err);
      }
    }

    const restoredDegrees = Object.values(restoredRules).map((rule) => rule.degree).filter(Number.isFinite);
    const supplementText = String(record.supplement_text || record.original_transcript || '').trim();
    setWorstSelectedDegree(restoredDegrees.length > 0 ? Math.min(...restoredDegrees) : null);
    setChiefComplaintData({
      selectedRules: restoredRules,
      supplementText,
    });
    const restoreToken = Date.now();
    setSessionRestore({
      token: restoreToken,
      selectedRules: restoredRules,
      recommendedSymptoms,
      supplementText,
    });
    setPendingHistoryRulesKey(restoreToken);
    setStage('main');
  }, []);


  const resetAllTriageState = () => {
    setSelectedSymptoms(new Set());
    setInputText('');
    setWorstSelectedDegree(null);
    setForceLevel1(false);
    setDirectToERSelected(false);
    setEditingDirectToER(false);

    setBed('');
    setPatientSource('');
    setMajorIncident('');
    setVisitTime(new Date().toISOString());

    setVitals(getInitialVitals());
    setTocc(getInitialTocc());
    setChiefComplaintData({
      selectedRules: {},
      supplementText: '',
    });
    setPendingHistoryRulesKey(null);
    setTriageActiveTab('a');
  };

  const resetMainScreen = () => {
    setSelectedSymptoms(new Set());
    setInputText('');
    setWorstSelectedDegree(null);
    setForceLevel1(false);
    setDirectToERSelected(false);
    setTriageActiveTab('a');
  };

  const handleLogout = () => {
    if (window.confirm('確定要登出系統？')) {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userData");
      setCurrentUser(null);
      setStage("login");
      resetMainScreen();
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      console.log("login response:", data);

      if (res.ok && data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userData", JSON.stringify(data.user));
        setCurrentUser(data.user);
        setStage("addpatient");
      } else {
        alert(data.detail || "帳號或密碼錯誤");
      }
    } catch (error) {
      alert("無法連線至後端伺服器");
    }
  };

  const handleConfirmAndSaveTriage = async (
    
    triageData: any,

    options?: {
      afterSaveStage?: "triageReport" | "addpatient";
      overrideRuleCode?: string;
      overrideChiefComplaint?: string;
    }
  ) => {
    if (globalConfig.requireTOCC) {
  const isToccEmpty =
    !tocc.travel &&
    !tocc.travelStart &&
    !tocc.travelEnd &&
    !tocc.occupation &&
    tocc.contactItems.length === 0 &&
    tocc.clusterItems.length === 0 &&
    tocc.symptoms.length === 0;

  if (isToccEmpty) {
    alert("TOCC 為必填，請完成 TOCC 資料");
    return;
  }
}

    const fullPayload = {
      triage_id: patientData?.triage_id ? patientData.triage_id : null,
      triageId: patientData?.triage_id ? patientData.triage_id : null,
      patientId: patientData?.patient_id ?? null,
      patient_id: patientData?.patient_id ?? null,
      name: patientData?.name ?? null,
      id_number: patientData?.idNumber ?? null,
      gender: patientData?.gender === "男" ? "M" : patientData?.gender === "女" ? "F" : "U",
      birth_date: patientData?.birthDate?.trim() || null,
      nurseId: currentUser?.nurseId ?? null,
      nurse_id: currentUser?.nurseId ?? null,
      demoMode: isDemoMode,

      bed, patientSource, majorIncident, visitTime,
      tocc_travel: tocc.travel, tocc_travel_start: tocc.travelStart, tocc_travel_end: tocc.travelEnd,
      tocc_occupation: tocc.occupation, tocc_occupation_other: tocc.occupationOther,
      tocc_contact_items: tocc.contactItems.join(', '), tocc_cluster_items: tocc.clusterItems.join(', '),
      tocc_cluster_other: tocc.clusterOther, tocc_symptoms: tocc.symptoms.join(', '),
      selectedSymptoms: Array.from(selectedSymptoms), inputText, worstSelectedDegree, selectedLevel: triageData.selectedLevel,
      result: {
        rule_code: options?.overrideRuleCode ?? Object.keys(chiefComplaintData.selectedRules).join(';'),
        chief_complaint: options?.overrideChiefComplaint ?? (inputText?.trim() || null),
        original_transcript: chiefComplaintData.supplementText?.trim() || null,
      },
      vitals: {
        temperature: parseFloat(vitals.temperature), heart_rate: parseInt(vitals.heartRate),
        spo2: parseInt(vitals.spo2), respiratory_rate: parseInt(vitals.respRate),
        weight: parseFloat(vitals.weight), blood_pressure_sys: parseInt(vitals.systolicBP),
        blood_pressure_dia: parseInt(vitals.diastolicBP), blood_sugar: parseInt(vitals.bloodSugar),
        gcs_eye: vitals.gcsEye, gcs_verbal: vitals.gcsVerbal, gcs_motor: vitals.gcsMotor,
        past_medical_history: [
          vitals.pastHistory.join(', '),
          vitals.otherHistoryDetails?.trim(),
        ]
          .filter(Boolean)
          .join('; '),
        do_not_treat: vitals.doNotTreat,
        allergy: vitals.drugAllergy, pain_score: vitals.painScore, sentiment: vitals.sentiment,
      },
      timestamp: new Date().toISOString(),
    };
    try {
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/triagesave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });
      if (res.ok) {
        const responseData = await res.json();

        setPatientData(prev =>
          prev ? { ...prev, triage_id: responseData.triageId } : prev
        );

        alert(`檢傷資料已儲存，ID: ${responseData.triageId}`);
        if (options?.afterSaveStage === "addpatient") {
          goToAddPatientClean();
        } else {
          if (userSettings.confirmBeforeSave) {
            setStage("triageReport");
          } else {
            goToAddPatientClean();
          }
        }
      } else {
        const errorData = await res.json();
        alert(`儲存失敗: ${errorData.detail || '未知錯誤'}`);
      }
    } catch (error) {
      alert('網路錯誤');
    }
  };

  const handleDirectToER = () => {
    if (!window.confirm('確定直入急救室？')) return;

    if (!patientData?.patient_id) {
      alert('尚未有病患資料，請先完成掛號');
      return;
    }

    const directRuleCode = 'R00000';
    const directJudgeName = '直入急救室 (OHCA/極危急)';

    setChiefComplaintData((prev) => ({
      ...prev,
      selectedRules: {
        [directRuleCode]: {
          degree: 1,
          judge: directJudgeName,
          rule_code: directRuleCode,
          symptom_name: '直入急救室',
        },
      },
    }));

    setForceLevel1(true);
    setDirectToERSelected(true);

    setSelectedSymptoms(prev => {
      const newSet = new Set(prev);
      newSet.add('直入急救室');
      return newSet;
    });

    void handleConfirmAndSaveTriage(
      {
        selectedLevel: 1,
      },
      {
        afterSaveStage: 'addpatient',
        overrideRuleCode: directRuleCode,
        overrideChiefComplaint: '直入急救室',
      }
    );
  };

  const handleChiefComplaintChange = useCallback((data: any) => {
    setChiefComplaintData(data);
  }, []);

  const runVoiceConsentFlow = async () => {
    const result = await openVoiceConsentPopup();

    if (result === 'agree') {
      setVoiceConsented(true);
      localStorage.setItem('voiceConsented', 'true');
      setStage('main');
      return;
    }

    if (result === 'disagree') {
      setVoiceConsented(false);
      localStorage.setItem('voiceConsented', 'false');
      setStage('main');
      return;
    }

    alert('同意書視窗未開啟，請確認瀏覽器已允許彈出視窗');
  };

  useEffect(() => {
    if (!patientData?.patient_id) return;
    if (isDemoMode) return;

    const fetchPatientDetail = async () => {
      try {
        const API_BASE_URL = getApiBaseUrl();
        const res = await fetch(`${API_BASE_URL}/patients/${patientData.patient_id}`);
        const result = await res.json();

        if (!res.ok || !result.success || !result.data) return;

        const p = result.data;

        setPatientData(prev => {
          if (!prev) return prev;

          return {
            ...prev,
            name: p.name ?? prev.name,
            idNumber: p.id_number ?? prev.idNumber,
            birthDate: p.birth_date ?? prev.birthDate,
            gender:
              p.gender === "M" ? "男" :
                p.gender === "F" ? "女" :
                  p.gender === "U" ? "不詳" :
                    prev.gender,
            age: p.age ?? prev.age,
            medicalId: p.medical_id ?? prev.medicalId,
            visitNumber: p.visit_number ?? prev.visitNumber,
            drugAllergy: p.drug_allergy ?? prev.drugAllergy,
            pastMedicalHistory: p.past_medical_history ?? prev.pastMedicalHistory,
            doNotTreat: p.do_not_treat ?? prev.doNotTreat,
          };
        });

        const parsedPast = parsePastMedicalHistory(p.past_medical_history);
        setVitals(prev => ({
          ...prev,
          drugAllergy: p.drug_allergy ?? prev.drugAllergy,
          pastHistory: p.past_medical_history != null ? parsedPast.pastHistory : prev.pastHistory,
          otherHistoryDetails: p.past_medical_history != null ? parsedPast.otherHistoryDetails : prev.otherHistoryDetails,
          doNotTreat: String(p.do_not_treat ?? ""),
        }));
      } catch (error) {
        console.error("抓病患詳細資料失敗:", error);
      }
    };

    fetchPatientDetail();
  }, [patientData?.patient_id, isDemoMode]);

  useEffect(() => {
    if (
      patientData?.drugAllergy === undefined &&
      patientData?.pastMedicalHistory === undefined &&
      patientData?.doNotTreat === undefined
    ) {
      return;
    }
    const parsedPast = parsePastMedicalHistory(patientData?.pastMedicalHistory);
    setVitals(prev => ({
      ...prev,
      drugAllergy: patientData?.drugAllergy ?? prev.drugAllergy,
      pastHistory: patientData?.pastMedicalHistory != null ? parsedPast.pastHistory : prev.pastHistory,
      otherHistoryDetails: patientData?.pastMedicalHistory != null ? parsedPast.otherHistoryDetails : prev.otherHistoryDetails,
      doNotTreat:
        patientData?.doNotTreat !== undefined
          ? String(patientData.doNotTreat ?? "")
          : prev.doNotTreat,
    }));
  }, [patientData?.drugAllergy, patientData?.pastMedicalHistory, patientData?.doNotTreat]);

  const goToAddPatientClean = () => {
    resetAllTriageState();
    setPatientData(null);
    setIsDemoMode(false);
    setStage("addpatient");
  };

  const openHistoryFromNurse = useCallback((keyword?: string, triageId?: string | null) => {
    setHistoryKeyword(keyword ?? '');
    setHistorySelectedId(triageId ?? null);
    setStage("history");
  }, []);

  const openNursePage = useCallback((nurseId: string) => {
    setSelectedNurseId(nurseId);
    setStage("nurses");
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "userSettings",
      JSON.stringify(userSettings)
    );
  }, [userSettings]);

  useEffect(() => {
    localStorage.setItem(
      "globalConfig",
      JSON.stringify(globalConfig)
    );
  }, [globalConfig]);

  // 非 admin 若被手動導到 nurses，強制導回
  useEffect(() => {
    if (stage === "nurses" && !isAdmin) {
      setStage("addpatient");
    }
  }, [stage, isAdmin]);

  if (stage === "login") return <Login onLogin={handleLogin} />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <aside className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 shadow-xl z-50 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex flex-col items-center">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 mb-4 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
            <svg className={`w-6 h-6 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
          {isSidebarOpen && <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 whitespace-nowrap">急診檢傷</h2>}
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4">
          {[
            { id: 'addpatient', label: '新病患掛號', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
            { id: 'history', label: '檢傷紀錄', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            ...(isAdmin
              ? [{ id: 'nurses', label: '護理師資訊', icon: 'M17 20h5v-1a4 4 0 00-4-4h-1M9 20H4v-1a4 4 0 014-4h1m6 0a4 4 0 10-8 0 4 4 0 008 0zm6-7a3 3 0 11-6 0 3 3 0 016 0z' }]
              : []),
            { id: 'stats', label: '統計分析', icon: 'M4 19V5m0 14h16M7 16V9m4 7V7m4 9v-4m4 4V4' },
            { id: 'profile', label: '個人設定與管理', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'history') {
                  setHistoryKeyword('');
                  setHistorySelectedId(null);
                }
                if (item.id === 'nurses') {
                  setSelectedNurseId(null);
                }
                setStage(item.id as any);
              }}
              className={`w-full flex items-center p-3 rounded-xl transition-all ${stage === item.id ? "bg-blue-600 text-white shadow-lg" : "text-gray-500 hover:bg-gray-100"}`}
              title={item.label}
            >
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              {isSidebarOpen && <span className="ml-3 font-semibold whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="px-3 mt-4">
          <button
            onClick={() => setLlmMode(prev => prev === 'cloud' ? 'local' : 'cloud')}
            className="w-full flex items-center justify-center p-3 rounded-xl text-white font-bold shadow-md transition-all"
            style={{
              backgroundColor: llmMode === 'cloud' ? '#16a34a' : '#2563eb'
            }}
            title={llmMode === 'cloud' ? '目前是雲端模式，點擊切換成地端模式' : '目前是地端模式，點擊切換成雲端模式'}
          >
            {isSidebarOpen
              ? (llmMode === 'cloud' ? '🌐 雲端模式' : '💻 地端模式')
              : (llmMode === 'cloud' ? '🌐' : '💻')}
          </button>
        </div>

        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleLogout} className="w-full flex items-center p-3 text-red-500 hover:bg-red-50 rounded-xl font-bold group" title="登出系統">
            <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span className="ml-3 whitespace-nowrap">登出系統</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 relative overflow-y-auto bg-[#F8FAFC]">
        {stage === "addpatient" && (
          <AddPatient
            onNext={(data) => {
              resetAllTriageState();
              setPatientData(data);
              setIsDemoMode(false);
              void runVoiceConsentFlow();
            }}
            onDemo={(data) => {
              resetAllTriageState();
              setPatientData(data);
              setIsDemoMode(true);
              void runVoiceConsentFlow();
            }}
          />
        )}

        {stage === "main" && (
          <div className="px-6 pt-2 pb-6 mx-auto max-w-screen-2xl grid grid-cols-[4.5fr_5.5fr] gap-x-6 gap-y-4">
            <ChiefComplaintProvider
              selectedSymptoms={selectedSymptoms}
              setSelectedSymptoms={setSelectedSymptoms}
              inputText={inputText}
              setInputText={setInputText}
              activeTab={triageActiveTab}
              setActiveTab={setTriageActiveTab}
              onWorstDegreeChange={setWorstSelectedDegree}
              onDirectToER={handleDirectToER}
              directToERSelected={directToERSelected}
              age={patientData?.age}
              voiceConsented={voiceConsented}
              vitals={vitals}
              onChiefComplaintChange={handleChiefComplaintChange}
              sessionRestore={sessionRestore}
              restoredSelectedRules={pendingHistoryRulesKey ? chiefComplaintData.selectedRules : undefined}
              restoredSelectedRulesKey={pendingHistoryRulesKey}
              onSessionRestoreApplied={handleSessionRestoreApplied}
              llmMode={llmMode}
            >
              <>
                <div className="col-span-full">
                  <PatientInfo
                    patient={patientData}
                    bed={bed}
                    setBed={setBed}
                    patientSource={patientSource}
                    setPatientSource={setPatientSource}
                    majorIncident={majorIncident}
                    setMajorIncident={setMajorIncident}
                    onToccChange={setTocc}
                    requireTOCC={globalConfig.requireTOCC}
                    onPatientChange={(updated) => {
                      setPatientData(prev => prev ? { ...prev, ...updated } as PatientData : prev);
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <LeftPanel
                    selectedSymptoms={selectedSymptoms}
                    setSelectedSymptoms={setSelectedSymptoms}
                    activeTab={triageActiveTab}
                    gender={patientData?.gender}
                    age={patientData?.age}
                    vitals={vitals}
                    setVitals={setVitals}
                    highlightDrugAllergy={
                      editingDirectToER && hasDirectErEditMissingFields(vitals)
                    }
                    highlightHistoricalDrugAllergy={
                      Boolean(patientData?.isReturning && vitals.drugAllergy)
                    }
                    highlightHistoricalPastHistory={
                      Boolean(patientData?.isReturning && patientData?.pastMedicalHistory)
                    }
                    highlightHistoricalDoNotTreat={
                      Boolean(patientData?.isReturning && patientData?.doNotTreat)
                    }
                  />
                </div>
                <div className="min-w-0 flex flex-col gap-4">
                  <ChiefComplaintRecommendationsPanel />
                  <SystemRecommendation
                    selectedSymptoms={selectedSymptoms}
                    inputText={inputText}
                    worstSelectedDegree={worstSelectedDegree}
                    forceLevel1={forceLevel1}
                    onSubmitLevel={resetMainScreen}
                    onOpenTriageReport={() => {
                      if (isDemoMode) {
                        alert("教學/模擬模式：不開啟檢傷報告頁");
                        return;
                      }

                      if (userSettings.confirmBeforeSave) {
                        setStage("triageReport");
                      } else {
                        handleConfirmAndSaveTriage({
                          selectedLevel: worstSelectedDegree,
                        });
                      }
                    }}
                    onConfirmAndSave={handleConfirmAndSaveTriage}
                  />
                </div>
              </>
            </ChiefComplaintProvider>
          </div>
        )}

        {stage === "history" && (
          <HistoryPage
            patientData={patientData}
            initialKeyword={historyKeyword}
            initialSelectedTriageId={historySelectedId}
            onViewNurse={openNursePage}
            onGoToMain={(record: any) => {
              void restoreTriageFromHistoryRecord(record);
            }}
          />
        )}

        {stage === "nurses" && isAdmin && (
          <NursesPage
            onOpenHistoryRecord={openHistoryFromNurse}
            initialSelectedNurseId={selectedNurseId}
          />
        )}

        {/* --- 新增個人設定頁面 --- */}
        {stage === "profile" && (
          <StaffProfile
            nurseInfo={currentUser}   // 把這裡的 nurseData 改成 currentUser
            isAdmin={isAdmin}
            userSettings={userSettings} // 記得要在 App 頂部定義這些 State (見下方)
            setUserSettings={setUserSettings}
            globalConfig={globalConfig}
            setGlobalConfig={setGlobalConfig}
          />
        )}

        {stage === "stats" && (
          <StatsPage />
        )}

        {stage === "triageReport" && (
          <EmergencyTriageReport
            patientData={patientData}
            onBack={goToAddPatientClean}
          />
        )}
      </main>
    </div>
  );
}

export default App;