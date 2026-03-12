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

function App() {
  // === 所有 state 定義（已有）===
  const [stage, setStage] = useState<"login" | "addpatient" | "main" | "triageReport">("login");
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState<string>('');
  const [worstSelectedDegree, setWorstSelectedDegree] = useState<number | null>(null);
  const [forceLevel1, setForceLevel1] = useState<boolean>(false);
  const [directToERSelected, setDirectToERSelected] = useState<boolean>(false);

  const resetMainScreen = () => {
    setSelectedSymptoms(new Set());
    setInputText('');
    setWorstSelectedDegree(null);
    setForceLevel1(false);
    setDirectToERSelected(false);
    //setStage('addpatient');
  };

  const handleDirectToER = () => {
    const ok = window.confirm('確定直入急救室？');
    if (!ok) return;
    setForceLevel1(true);
    setDirectToERSelected(true);
    alert('確定級數：第1級');
    console.log('確定級數：', 1);
    resetMainScreen();
  };

  // 病患資料
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  // 病房 / 來源 / 大傷（提升到 App 層以供報表使用）
  const [bed, setBed] = useState<string>('');
  const [patientSource, setPatientSource] = useState<string>('');
  const [majorIncident, setMajorIncident] = useState<string>('');

  // === 新增：生命徵象 state（對應 Vitals.tsx 的 vitals props）===
  const [vitals, setVitals] = useState({
    temperature: '',
    heartRate: '',
    spo2: '',
    respRate: '',
    weight: '',
    systolicBP: '',
    diastolicBP: '',
    bloodSugar: '',
    bloodSugarLevel: null,
    gcsEye: null,
    gcsVerbal: null,
    gcsMotor: null,
    obHistory: null,
    pastHistory: [],
    drugAllergy: null,
    painScore: null,
    doNotTreat: '',
    sentiment: null,
  });

  // === 新增：ChiefComplaint 的資料 ===
  const [chiefComplaintData, setChiefComplaintData] = useState({
    selectedRules: {} as Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }>,
    supplementText: '',
  });

  const handleChiefComplaintChange = useCallback((data: {
    selectedRules: Record<string, { degree: number; judge: string; rule_code: string; symptom_name: string }>;
    supplementText: string;
  }) => {
    setChiefComplaintData(data);
  }, []);

  // === 新增：TOCC 資料 state ===
  const [tocc, setTocc] = useState<ToccState>({
    travel: "",
    travelStart: "",
    travelEnd: "",
    occupation: "",
    occupationOther: "",
    contactItems: [],
    clusterItems: [],
    clusterOther: "",
    symptoms: [],
  });

  // === 新增：visit_time（看診時間）===
  const [visitTime, setVisitTime] = useState<string>(new Date().toISOString());

  // 在最上面加 interface（如果還沒有的話）
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

  // === 新增：handleConfirmAndSaveTriage ===
  const handleConfirmAndSaveTriage = async (triageData: any) => {
    const fullPayload = {
      // PatientInfo 的資訊
      bed,
      patientSource,
      majorIncident,
      visitTime,

      // TOCC 資訊
      tocc_travel: tocc.travel,
      tocc_travel_start: tocc.travelStart,
      tocc_travel_end: tocc.travelEnd,
      tocc_occupation: tocc.occupation,
      tocc_occupation_other: tocc.occupationOther,
      tocc_contact_items: tocc.contactItems.join(', '),
      tocc_cluster_items: tocc.clusterItems.join(', '),
      tocc_cluster_other: tocc.clusterOther,
      tocc_symptoms: tocc.symptoms.join(', '),

      // SystemRecommendation 的資料
      selectedSymptoms: triageData.selectedSymptoms,
      inputText: triageData.inputText,
      worstSelectedDegree: triageData.worstSelectedDegree,
      selectedLevel: triageData.selectedLevel,

      // ChiefComplaint 的資料
      result: {
        rule_code: Object.keys(chiefComplaintData.selectedRules).join(';'),
        notes: chiefComplaintData.supplementText,
      },

      // Vitals 的資料
      vitals: {
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
        heart_rate: vitals.heartRate ? parseInt(vitals.heartRate) : null,
        spo2: vitals.spo2 ? parseInt(vitals.spo2) : null,
        respiratory_rate: vitals.respRate ? parseInt(vitals.respRate) : null,
        weight: vitals.weight ? parseFloat(vitals.weight) : null,
        blood_pressure_sys: vitals.systolicBP ? parseInt(vitals.systolicBP) : null,
        blood_pressure_dia: vitals.diastolicBP ? parseInt(vitals.diastolicBP) : null,
        blood_sugar: vitals.bloodSugar ? parseInt(vitals.bloodSugar) : null,
        gcs_eye: vitals.gcsEye ? parseInt(vitals.gcsEye) : null,
        gcs_verbal: vitals.gcsVerbal ? parseInt(vitals.gcsVerbal) : null,
        gcs_motor: vitals.gcsMotor ? parseInt(vitals.gcsMotor) : null,
        past_medical_history: vitals.pastHistory.join(', '),
        do_not_treat: vitals.doNotTreat,
        allergy: vitals.drugAllergy,
        pain_score: vitals.painScore,
        sentiment: vitals.sentiment,
      },

      timestamp: new Date().toISOString(),
    };

    // ========== 📝 開始：調試紀錄 ==========
    console.log('🚀 [開始發送檢傷資料]');
    console.log('📦 完整 payload:', fullPayload);
    console.log('🏥 PatientInfo:', {
      bed,
      patientSource,
      majorIncident,
      visitTime,
    });
    console.log('🏷️ ChiefComplaint:', chiefComplaintData);
    console.log('🏷️ selectedRules keys:', Object.keys(chiefComplaintData.selectedRules));
    console.log('🏷️ result.rule_code:', Object.keys(chiefComplaintData.selectedRules).join(';'));
    console.log('❤️ Vitals:', fullPayload.vitals);
    console.log('🔢 SystemRecommendation:', {
      selectedSymptoms: triageData.selectedSymptoms,
      inputText: triageData.inputText,
      worstSelectedDegree: triageData.worstSelectedDegree,
      selectedLevel: triageData.selectedLevel,
    });
    // ========== 📝 結束：調試紀錄 ==========

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      console.log('🌐 API_BASE_URL:', API_BASE_URL);
      console.log('📤 發送到:', `${API_BASE_URL}/triagesave`);

      const res = await fetch(`${API_BASE_URL}/triagesave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });

      console.log('✅ 回應狀態碼:', res.status);
      console.log('✅ 回應 OK:', res.ok);

      if (res.ok) {
        const responseData = await res.json();
        console.log('✅ 後端回應:', responseData);
        alert(`檢傷資料已儲存，ID: ${responseData.triageId}`);
      } else {
        const errorData = await res.json();
        console.error('❌ 後端錯誤:', errorData);
        alert(`儲存失敗: ${errorData.detail || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('❌ 網路錯誤:', error);
      alert('網路錯誤');
    }
  };

  // ----------------------------
  // 1️⃣ Login 頁面
  // ----------------------------
  if (stage === "login") {
    return <Login onLogin={() => setStage("addpatient")} />;
  }

  // ----------------------------
  // 2️⃣ AddPatient 頁面
  // ----------------------------
  if (stage === "addpatient") {
    return (
      <AddPatient
        onNext={(data) => {
          setPatientData(data);  // 存資料
          setStage("main");      // 切換到主畫面
        }}
      />
    );
  }
  // ----------------------------
  // 4️⃣ EmergencyTriageReport 頁面
  // ----------------------------
  if (stage === "triageReport") {
    return (
      <EmergencyTriageReport
        patientData={patientData}
        inputText={inputText}
        selectedSymptoms={selectedSymptoms}
        worstSelectedDegree={worstSelectedDegree}
        bed={bed}
        patientSource={patientSource}
        majorIncident={majorIncident}
        onBack={() => setStage('main')}
      />
    );
  }

  // ----------------------------
  // 3️⃣ Main 主畫面
  // ----------------------------
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <div className="grid grid-cols-10 gap-8">
            <div className="col-span-10">
              <PatientInfo
                patient={patientData}
                bed={bed}
                setBed={setBed}
                patientSource={patientSource}
                setPatientSource={setPatientSource}
                majorIncident={majorIncident}
                setMajorIncident={setMajorIncident}
                onToccChange={(toccData) => setTocc(toccData)}  // ← 新增這行
              />
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
                onChiefComplaintChange={handleChiefComplaintChange}  // ← 修改這行
              />
            </div>

            <div className="col-span-4">
              <div className="flex flex-col gap-6">
                <SystemRecommendation
                  selectedSymptoms={selectedSymptoms}
                  inputText={inputText}
                  worstSelectedDegree={worstSelectedDegree}
                  forceLevel1={forceLevel1}
                  onSubmitLevel={resetMainScreen}
                  onOpenTriageReport={() => setStage("triageReport")}
                  onConfirmAndSave={handleConfirmAndSaveTriage}  // ← 新增這行
                />
                <Vitals
                  gender={patientData?.gender}
                  vitals={vitals}        // ← 新增：傳 vitals state
                  setVitals={setVitals}  // ← 新增：傳 setVitals 函式
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

}

export default App;
