import { useState } from 'react';
import './App.css';
import PatientInfo from './components/PatientInfo';
import LeftPanel from './components/LeftPanel';
import Vitals from './components/Vitals';
import Login from "./components/Login";
<<<<<<< HEAD
import AddPatient from "./components/AddPatient";
import type { PatientData } from './components/AddPatient';
=======
import AddPatient from "./components/AddPatient";  // ⬅️ 你要新增這個檔案
>>>>>>> nico
import SystemRecommendation from './components/SystemRecommendation';

function App() {

  // 管理目前系統在哪一頁：login → addpatient → main
  const [stage, setStage] = useState<"login" | "addpatient" | "main">("login");

  // 症狀與主訴
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
    setStage('addpatient');
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
<<<<<<< HEAD

  // 病患資料
  const [patientData, setPatientData] = useState<PatientData | null>(null);

=======
>>>>>>> nico

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
  // 3️⃣ Main 主畫面
  // ----------------------------
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
<<<<<<< HEAD
          <div className="grid grid-cols-2 gap-8">
            <div className="col-span-2">
              <PatientInfo patient={patientData} />
=======
          <div className="grid grid-cols-10 gap-8">
            <div className="col-span-10">
              <PatientInfo />
>>>>>>> nico
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
                />
                <Vitals />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
