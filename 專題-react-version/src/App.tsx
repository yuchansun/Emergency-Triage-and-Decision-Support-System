import { useState } from 'react';
import './App.css';
import PatientInfo from './components/PatientInfo';
import LeftPanel from './components/LeftPanel';
import Vitals from './components/Vitals';
import Login from "./components/Login";

function App() {
  // 管理選中的症狀和主訴輸入
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState<string>('');

  // 管理登入狀態
  const [loggedIn, setLoggedIn] = useState(false);
  // 若尚未登入 → 顯示登入頁
  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <div className="grid grid-cols-2 gap-8">
            <div className="col-span-2">
              <PatientInfo />
            </div>
            <LeftPanel selectedSymptoms={selectedSymptoms} setSelectedSymptoms={setSelectedSymptoms} inputText={inputText} setInputText={setInputText} />
            <Vitals />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
