import { useState } from 'react';
import './App.css';
import PatientInfo from './components/PatientInfo';
import LeftPanel from './components/LeftPanel';
import Vitals from './components/Vitals';
import Login from "./components/Login";
import AddPatient from "./components/AddPatient";
import type { PatientData } from './components/AddPatient';

function App() {

  // 管理目前系統在哪一頁：login → addpatient → main
  const [stage, setStage] = useState<"login" | "addpatient" | "main">("login");

  // 症狀與主訴
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState<string>('');

  // 病患資料
  const [patientData, setPatientData] = useState<PatientData | null>(null);


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
          <div className="grid grid-cols-2 gap-8">
            <div className="col-span-2">
              <PatientInfo patient={patientData} />
            </div>

            <LeftPanel
              selectedSymptoms={selectedSymptoms}
              setSelectedSymptoms={setSelectedSymptoms}
              inputText={inputText}
              setInputText={setInputText}
            />

            <Vitals />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
