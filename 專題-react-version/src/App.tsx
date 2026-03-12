import { useState, useEffect, useRef } from 'react';
import './App.css';
import PatientInfo from './components/PatientInfo';
import LeftPanel from './components/LeftPanel';
import Vitals from './components/Vitals';
import Login from "./components/Login";
import AddPatient from "./components/AddPatient";
import type { PatientData } from './components/AddPatient';
import SystemRecommendation from './components/SystemRecommendation';

const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [stage, setStage] = useState<"login" | "addpatient" | "main">(() => {
    return (localStorage.getItem("app_stage") as any) || "login";
  });

  const [patientData, setPatientData] = useState<PatientData | null>(() => {
    const saved = localStorage.getItem("patient_data");
    return saved ? JSON.parse(saved) : null;
  });

  const [isReturning, setIsReturning] = useState<boolean>(() => {
    return localStorage.getItem("is_returning") === "true";
  });

  // --- 🔒 強力防護鎖 ---
  const isSubmittingRef = useRef(false);
  const lastProcessedId = useRef<string | null>(null);

  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState<string>('');
  const [worstSelectedDegree, setWorstSelectedDegree] = useState<number | null>(null);
  const [forceLevel1, setForceLevel1] = useState<boolean>(false);
  const [directToERSelected, setDirectToERSelected] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("app_stage", stage);
    localStorage.setItem("is_returning", String(isReturning));
    if (patientData) {
      localStorage.setItem("patient_data", JSON.stringify(patientData));
    } else {
      localStorage.removeItem("patient_data");
    }
  }, [stage, patientData, isReturning]);

  // --- 1. 處理病人建立 (修正老病人提示) ---
  const handleCreatePatient = async (data: PatientData) => {
    try {
      const resp = await fetch(`${API_BASE}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await resp.json();

      if (resp.ok) {
        // 💡 修正：如果 status 是 exists，立刻跳提示
        if (result.status === "exists") {
          alert(`提示：此病人曾有就診紀錄 (病歷號: ${result.patient_id})，將自動載入舊資料。`);
        }

        // 初始化所有狀態，確保新的一輪檢傷是乾淨的
        setSelectedSymptoms(new Set());
        setInputText('');
        setWorstSelectedDegree(null);
        setForceLevel1(false);
        setDirectToERSelected(false);
        lastProcessedId.current = null; // 清除上一個成功掛號的 ID 鎖

        setIsReturning(result.status === "exists");
        setPatientData({ ...data, patient_id: result.patient_id });
        setStage("main");
      } else {
        alert("無法處理病人資料: " + (result.detail || "未知錯誤"));
      }
    } catch (e) {
      alert("網路請求失敗");
    }
  };

  // --- 2. 徹底防止重複掛號 (修正自動多掛號 Bug) ---
  const resetMainScreen = async (recommendationData?: any) => {
    // 🛡️ 物理鎖與 ID 鎖攔截
    if (isSubmittingRef.current || !patientData || !patientData.patient_id) return;
    
    const currentId = String(patientData.patient_id);
    if (lastProcessedId.current === currentId) {
      console.log("🛑 攔截重複掛號請求");
      return;
    }

    try {
      isSubmittingRef.current = true; // 上鎖

      const payload = {
        patient_id: patientData.patient_id,
        nurse_id: 1, 
        system_name: recommendationData?.system_name || "未分類",
        symptom_name: recommendationData?.symptom_name || Array.from(selectedSymptoms).join(", ") || "無明顯症狀",
        ttas_degree: recommendationData?.ttas_degree || worstSelectedDegree || (forceLevel1 ? 1 : 5),
        nhi_degree: recommendationData?.nhi_degree || 4
      };

      const resp = await fetch(`${API_BASE}/api/triage/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (resp.ok) {
        lastProcessedId.current = currentId; // 記住成功掛號的 ID
        alert(`掛號成功！`);

        // 💡 關鍵順序：先清空資料，再切換頁面
        localStorage.removeItem("patient_data");
        setPatientData(null);
        setSelectedSymptoms(new Set());
        setInputText('');
        setWorstSelectedDegree(null);
        setForceLevel1(false);
        setDirectToERSelected(false);
        setIsReturning(false);
        
        setStage('addpatient'); 
      }
    } catch (e) {
      alert("儲存紀錄失敗");
    } finally {
      // 延遲一秒解鎖，防止跳轉期間的誤觸
      setTimeout(() => { isSubmittingRef.current = false; }, 1000);
    }
  };

  const handleLogin = async (id: string, pass: string) => {
    try {
      const resp = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: id, password: pass }),
      });
      if (resp.ok) setStage("addpatient");
      else alert("登入失敗");
    } catch (e) { alert("連線失敗"); }
  };

  const handleDirectToER = () => {
    if (window.confirm('確定直入急救室？')) {
      resetMainScreen({
        system_name: "緊急救護",
        symptom_name: "直入急救室",
        ttas_degree: 1,
        nhi_degree: 1
      });
    }
  };

  const handleLogout = () => {
    if (window.confirm("確定登出？")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (stage === "login") return <Login onLogin={handleLogin} />;
  if (stage === "addpatient") return <AddPatient onNext={handleCreatePatient} />;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <button onClick={handleLogout} className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200/50 text-gray-500 hover:bg-red-500 hover:text-white transition-all shadow-lg backdrop-blur-md">
        <span className="material-symbols-outlined">logout</span>
      </button>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <div className="grid grid-cols-10 gap-8">
            <div className="col-span-10">
              <PatientInfo patient={patientData} isReturning={isReturning} />
            </div>
            <div className="col-span-6">
              <LeftPanel
                selectedSymptoms={selectedSymptoms}
                setSelectedSymptoms={setSelectedSymptoms}
                inputText={inputText}
                setInputText={setInputText}
                onWorstDegreeChange={setWorstSelectedDegree}
                onDirectToER={handleDirectToER}
                directToERSelected={directToERSelected}
                age={patientData?.age}
              />
            </div>
            <div className="col-span-4">
              <div className="flex flex-col gap-6">
                <SystemRecommendation
                  selectedSymptoms={selectedSymptoms}
                  inputText={inputText}
                  worstSelectedDegree={worstSelectedDegree}
                  forceLevel1={forceLevel1}
                  onOpenTriageReport={() => {}}
                  onSubmitLevel={() => resetMainScreen()} 
                />
                <Vitals gender={patientData?.gender} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;