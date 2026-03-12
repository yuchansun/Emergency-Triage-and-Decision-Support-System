import { useState } from "react";

export interface PatientData {
  name: string;
  idNumber: string;
  birthDate: string;
  triage_id?: string; // 改為可選，因為一開始可能還沒有
  gender: "男" | "女" | "不詳" | "";
  icCard: boolean;
  patient_id?: number;
  age?: number; // 👈 補上這個，解決 App.tsx 傳給 LeftPanel 的紅線
}

export default function AddPatient({
  onNext,
}: {
  onNext: (data: PatientData) => void;
}) {
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"男" | "女" | "不詳" | "">("");
  const [icCard, setIcCard] = useState(false);

  // 1. IC 卡讀取
  const handleReadICCard = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/");
      const data = await res.json();
      if (!data || data.length === 0) {
        alert("未偵測到健保卡，請確認已插入讀卡機！");
        return;
      }
      const card = data[0];
      setIcCard(true);
      setName(card.full_name || "");
      setIdNumber(card.id_no || "");
      
      // 處理生日格式 (YYYY-MM-DD)
      let bDate = card.birth_date || "";
      if (/^\d{8}$/.test(bDate)) {
        bDate = `${bDate.slice(0, 4)}-${bDate.slice(4, 6)}-${bDate.slice(6, 8)}`;
      }
      setBirthDate(bDate);
      
      const sexConvert = card.sex === "M" ? "男" : card.sex === "F" ? "女" : "不詳";
      setGender(sexConvert);
    } catch (error) {
      alert("讀取 IC 卡失敗。");
    }
  };

  // 2. 清除
  const handleClear = () => {
    setName("");
    setIdNumber("");
    setBirthDate("");
    setGender("");
    setIcCard(false);
  };

 // 3. 確認掛號
  const handleConfirm = async () => {
    try {
      // Step A: 儲存/歸戶病人
      const pResponse = await fetch("http://127.0.0.1:8000/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, idNumber, birthDate: birthDate || null, gender }),
      });
      const pResult = await pResponse.json();
      
      if (!pResponse.ok || !pResult.patient_id) {
        alert("儲存病患資料失敗：" + (pResult.message || "伺服器錯誤"));
        return;
      }

      // Step B: 建立掛號紀錄 (ER 編號)
      const triageResponse = await fetch("http://127.0.0.1:8000/api/triage/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: pResult.patient_id, nurse_id: 1 }),
      });
      const tResult = await triageResponse.json();

      if (triageResponse.ok && tResult.status === "success") {
        alert(`掛號成功！\n就醫編號: ${tResult.triage_id}`);
        
        // 計算年齡
        const calculateAge = (bDay: string) => {
          if (!bDay) return 0;
          const birth = new Date(bDay);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          return age;
        };

        // 這裡「只呼叫一次」onNext，並把所有欄位補齊
        onNext({
          name,
          idNumber,
          birthDate,
          triage_id: tResult.triage_id,
          gender,
          icCard,
          patient_id: pResult.patient_id,
          age: calculateAge(birthDate) 
        });
      } else {
        alert("掛號失敗：" + (tResult.message || "未知錯誤"));
      }
    } catch (error) {
      alert("連線後端失敗。");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-10">
        <h1 className="text-3xl font-extrabold text-center mb-10 text-slate-800">急診掛號系統</h1>

        <button 
          onClick={handleReadICCard} 
          className="w-full py-4 mb-8 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xl shadow-lg transition-all active:scale-95"
        >
          IC卡
        </button>

        <div className="space-y-6">
          <div>
            <label className="block text-slate-500 mb-2 ml-1 text-sm font-bold">病患姓名</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none transition-all bg-slate-50" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-500 mb-2 ml-1 text-sm font-bold">身分證字號</label>
              <input 
                type="text" 
                value={idNumber} 
                onChange={(e) => setIdNumber(e.target.value)} 
                className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none transition-all bg-slate-50" 
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-2 ml-1 text-sm font-bold">性別</label>
              <select 
                value={gender} 
                onChange={(e) => setGender(e.target.value as any)} 
                className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none transition-all bg-slate-50 appearance-none"
              >
                <option value="">請選擇</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="不詳">不詳</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 mb-2 ml-1 text-sm font-bold">出生日期</label>
            <input 
              type="date" 
              value={birthDate} 
              onChange={(e) => setBirthDate(e.target.value)} 
              className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none transition-all bg-slate-50" 
            />
          </div>
        </div>

        <div className="flex gap-4 mt-12">
          <button 
            onClick={handleClear} 
            className="flex-1 bg-slate-100 py-4 rounded-2xl hover:bg-slate-200 transition font-bold text-slate-500"
          >
            清除
          </button>
          <button 
            onClick={handleConfirm} 
            className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl hover:bg-emerald-600 shadow-lg transition-all font-bold text-xl active:scale-95"
          >
            確認掛號
          </button>
        </div>
      </div>
    </div>
  );
}