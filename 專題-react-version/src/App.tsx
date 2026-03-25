import { useState, useCallback } from 'react';
import './App.css';
import PatientInfo from './components/PatientInfo';
import LeftPanel from './components/LeftPanel';
import Vitals from './components/Vitals';
import Login from "./components/Login";
import AddPatient from "./components/AddPatient";
import type { PatientData } from './components/AddPatient';
import SystemRecommendation from './components/SystemRecommendation';
import EmergencyTriageReport from './components/EmergencyTriageReport';

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
  // === 1. State 定義 ===
  const [stage, setStage] = useState<"login" | "addpatient" | "main" | "triageReport" | "history">(
    (localStorage.getItem("isLoggedIn") === "true") ? "addpatient" : "login"
  );
  
  const [currentUser, setCurrentUser] = useState<{ name: string; nurseId: string; role: string } | null>(
    localStorage.getItem("userData") ? JSON.parse(localStorage.getItem("userData")!) : null
  );

  // 控制側邊欄收縮 (預設收起)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  //const [llmMode, setLlmMode] = useState<'cloud' | 'local'>('cloud'); //新加
  const [llmMode, setLlmMode] = useState<'cloud' | 'local'>('local'); // 預設為地端模式，開發階段方便測試

  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState<string>('');
  const [worstSelectedDegree, setWorstSelectedDegree] = useState<number | null>(null);
  const [forceLevel1, setForceLevel1] = useState<boolean>(false);
  const [directToERSelected, setDirectToERSelected] = useState<boolean>(false);

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [bed, setBed] = useState<string>('');
  const [patientSource, setPatientSource] = useState<string>('');
  const [majorIncident, setMajorIncident] = useState<string>('');

  const [vitals, setVitals] = useState({
    temperature: '', heartRate: '', spo2: '', respRate: '', weight: '',
    systolicBP: '', diastolicBP: '', bloodSugar: '', bloodSugarLevel: null,
    gcsEye: null, gcsVerbal: null, gcsMotor: null, obHistory: null,
    pastHistory: [], drugAllergy: null, painScore: null, doNotTreat: '', sentiment: null,
  });

  const [chiefComplaintData, setChiefComplaintData] = useState({
    selectedRules: {} as Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }>,
    supplementText: '',
  });

  const [tocc, setTocc] = useState<ToccState>({
    travel: "", travelStart: "", travelEnd: "", occupation: "", occupationOther: "",
    contactItems: [], clusterItems: [], clusterOther: "", symptoms: [],
  });

  const [visitTime, setVisitTime] = useState<string>(new Date().toISOString());

  // === 2. 邏輯函式 ===
  const resetMainScreen = () => {
    setSelectedSymptoms(new Set());
    setInputText('');
    setWorstSelectedDegree(null);
    setForceLevel1(false);
    setDirectToERSelected(false);
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
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:9000";
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

  const handleConfirmAndSaveTriage = async (triageData: any) => {
    const fullPayload = {
      bed, patientSource, majorIncident, visitTime,
      tocc_travel: tocc.travel, tocc_travel_start: tocc.travelStart, tocc_travel_end: tocc.travelEnd,
      tocc_occupation: tocc.occupation, tocc_occupation_other: tocc.occupationOther,
      tocc_contact_items: tocc.contactItems.join(', '), tocc_cluster_items: tocc.clusterItems.join(', '),
      tocc_cluster_other: tocc.clusterOther, tocc_symptoms: tocc.symptoms.join(', '),
      selectedSymptoms: Array.from(selectedSymptoms), inputText, worstSelectedDegree, selectedLevel: triageData.selectedLevel,
      result: { rule_code: Object.keys(chiefComplaintData.selectedRules).join(';'), notes: chiefComplaintData.supplementText },
      vitals: {
        temperature: parseFloat(vitals.temperature), heart_rate: parseInt(vitals.heartRate),
        spo2: parseInt(vitals.spo2), respiratory_rate: parseInt(vitals.respRate),
        weight: parseFloat(vitals.weight), blood_pressure_sys: parseInt(vitals.systolicBP),
        blood_pressure_dia: parseInt(vitals.diastolicBP), blood_sugar: parseInt(vitals.bloodSugar),
        gcs_eye: vitals.gcsEye, gcs_verbal: vitals.gcsVerbal, gcs_motor: vitals.gcsMotor,
        past_medical_history: vitals.pastHistory.join(', '), do_not_treat: vitals.doNotTreat,
        allergy: vitals.drugAllergy, pain_score: vitals.painScore, sentiment: vitals.sentiment,
      },
      timestamp: new Date().toISOString(),
    };
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:9000";
      const res = await fetch(`${API_BASE_URL}/triagesave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });
      if (res.ok) {
        const responseData = await res.json();
        alert(`檢傷資料已儲存，ID: ${responseData.triageId}`);
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
    setForceLevel1(true);
    setDirectToERSelected(true);
    alert('確定級數：第1級');
    resetMainScreen();
  };

  const handleChiefComplaintChange = useCallback((data: any) => {
    setChiefComplaintData(data);
  }, []);

  // === 3. 渲染判斷 ===
  if (stage === "login") return <Login onLogin={handleLogin} />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      
      {/* === 側邊導覽欄 (Sidebar) === */}
      <aside className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 shadow-xl z-50 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex flex-col items-center">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 mb-4 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
            <svg className={`w-6 h-6 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
          {isSidebarOpen && <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 whitespace-nowrap">急診檢傷</h2>}
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4">
          {[
            { id: 'main', label: '當前檢傷作業', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { id: 'history', label: '過去病史查詢', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'addpatient', label: '新病患掛號', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' }
          ].map((item) => (
            <button key={item.id} onClick={() => setStage(item.id as any)} className={`w-full flex items-center p-3 rounded-xl transition-all ${stage === item.id ? "bg-blue-600 text-white shadow-lg" : "text-gray-500 hover:bg-gray-100"}`} title={item.label}>
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

      {/* === 右側主內容 === */}
      <main className="flex-1 relative overflow-y-auto bg-[#F8FAFC]">
        {stage === "addpatient" && (
          <AddPatient onNext={(data) => { setPatientData(data); setStage("main"); }} />
        )}

        {stage === "main" && (
          <div className="px-6 py-8 mx-auto max-w-screen-2xl grid grid-cols-10 gap-8">
            <div className="col-span-10">
              <PatientInfo patient={patientData} bed={bed} setBed={setBed} patientSource={patientSource} setPatientSource={setPatientSource} majorIncident={majorIncident} setMajorIncident={setMajorIncident} onToccChange={setTocc} />
            </div>
            <div className="col-span-6">
              <LeftPanel selectedSymptoms={selectedSymptoms} setSelectedSymptoms={setSelectedSymptoms} inputText={inputText} setInputText={setInputText} onWorstDegreeChange={setWorstSelectedDegree} onDirectToER={handleDirectToER} directToERSelected={directToERSelected} age={patientData?.age} onChiefComplaintChange={handleChiefComplaintChange} llmMode={llmMode}/>
            </div>
            <div className="col-span-4 flex flex-col gap-6">
              <SystemRecommendation selectedSymptoms={selectedSymptoms} inputText={inputText} worstSelectedDegree={worstSelectedDegree} forceLevel1={forceLevel1} onSubmitLevel={resetMainScreen} onOpenTriageReport={() => setStage("triageReport")} onConfirmAndSave={handleConfirmAndSaveTriage} />
              <Vitals gender={patientData?.gender} vitals={vitals} setVitals={setVitals} />
            </div>
          </div>
        )}

        {stage === "history" && (
          <div className="p-10 flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">過去病史查詢</h1>
            <p className="text-gray-400 mt-2">歷史數據庫連線中...</p>
          </div>
        )}

        {stage === "triageReport" && (
          <EmergencyTriageReport patientData={patientData} onBack={() => setStage('main')} />
        )}
      </main>
    </div>
  );
}

export default App;