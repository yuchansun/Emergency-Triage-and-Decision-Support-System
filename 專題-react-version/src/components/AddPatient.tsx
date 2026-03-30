import { useState } from "react";

export interface PatientData {
  name: string;
  idNumber: string;
  birthDate: string;
  triage_id: string; 
  gender: "男" | "女" | "不詳" | "";
  icCard: boolean;
  patient_id?: string; 
  age?: number;
  medicalId?: string;
  visitNumber?: string;
}

export default function AddPatient({
  onNext,
  onDemo,
}: {
  onNext: (data: PatientData) => void;
  onDemo: () => void;
}) {
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"男" | "女" | "不詳" | "">("");
  const [icCard, setIcCard] = useState(false);
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null);

  // 1. 自動搜尋現有病人 (手打身分證後觸發)
  const checkPatient = async (id: string) => {
    if (!id || id.length < 5) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/patients/search/${id}`);
      const result = await res.json();
      if (result.success && result.data) {
        const p = result.data;
        setName(p.name);
        setBirthDate(p.birth_date || "");
        setGender(p.gender === "M" ? "男" : p.gender === "F" ? "女" : "不詳");
        setExistingPatientId(p.patient_id);
      }
    } catch (e) {
      console.log("新病人");
    }
  };

  // 2. IC 卡讀取
  const handleReadICCard = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/"); 
      const data = await res.json();
      if (!data || data.length === 0) {
        alert("未偵測到健保卡！");
        return;
      }
      const card = data[0];
      setIcCard(true);
      setName(card.full_name || "");
      setIdNumber(card.id_no || "");
      
      let bDate = card.birth_date || "";
      if (/^\d{8}$/.test(bDate)) {
        bDate = `${bDate.slice(0, 4)}-${bDate.slice(4, 6)}-${bDate.slice(6, 8)}`;
      }
      setBirthDate(bDate);
      setGender(card.sex === "M" ? "男" : card.sex === "F" ? "女" : "不詳");
      
      // 讀完卡立刻查一次資料庫
      checkPatient(card.id_no);
    } catch (error) {
      alert("讀取 IC 卡失敗。");
    }
  };

  const handleClear = () => {
    setName("");
    setIdNumber("");
    setBirthDate("");
    setGender("");
    setIcCard(false);
    setExistingPatientId(null);
  };

  // 3. 確認掛號
const handleConfirm = async () => {
    try {
      // Step A: 儲存病人
      const pResponse = await fetch("http://127.0.0.1:8000/patients/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          patient_id: existingPatientId, 
          name: name || "匿名", 
          id_number: idNumber, 
          birth_date: birthDate || null, 
          gender: gender === "男" ? "M" : gender === "女" ? "F" : "U" 
        }),
      });
      const pResult = await pResponse.json();
      if (!pResult.patient_id) throw new Error("病人存檔失敗");

      // Step B: 建立檢傷紀錄 
      const tResponse = await fetch("http://127.0.0.1:8000/triagesave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          patientId: pResult.patient_id, 
          nurseId: "N01",
          vitals: {}, 
          result: {}, 
          bed: "",
          patientSource: "自行就醫",
          majorIncident: "否",
          visitTime: new Date().toISOString()
        }),
      });
      const tResult = await tResponse.json();

      if (tResult.success) {
        // --- 重點修改區域 ---
        // 使用 pResult.message (後端回傳的初診/回診訊息) 加上 tResult.triageId
        const statusMsg = pResult.is_returning ? "【回診】" : "【初診】";
        alert(`掛號成功！${statusMsg}\n編號: ${tResult.triageId}`);
        // ------------------

        onNext({
          name,
          idNumber,
          birthDate,
          triage_id: tResult.triageId,
          gender,
          icCard,
          patient_id: pResult.patient_id,
        });
      } else {
        alert("掛號失敗：" + tResult.detail);
      }
    } catch (error) {
      console.error(error);
      alert("連線失敗，請檢查後端 Terminal 報錯訊息");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-10">
        <h1 className="text-3xl font-extrabold text-center mb-10 text-slate-800">急診掛號系統</h1>

        <button onClick={handleReadICCard} className="w-full py-4 mb-8 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xl shadow-lg transition-all active:scale-95">
          讀取健保卡 (IC)
        </button>

        <div className="space-y-6">
          <div>
            <label className="block text-slate-500 mb-2 font-bold text-sm">姓名</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none bg-slate-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-500 mb-2 font-bold text-sm">身分證字號</label>
              <input 
                type="text" 
                value={idNumber} 
                onChange={(e) => setIdNumber(e.target.value.toUpperCase())} 
                onBlur={() => checkPatient(idNumber)}
                className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none bg-slate-50" 
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-2 font-bold text-sm">性別</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none bg-slate-50">
                <option value="">請選擇</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="不詳">不詳</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 mb-2 font-bold text-sm">出生日期</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-400 outline-none bg-slate-50" />
          </div>
        </div>

        <div className="flex gap-4 mt-12">
          <button onClick={handleClear} className="flex-1 bg-slate-100 py-4 rounded-2xl hover:bg-slate-200 transition font-bold text-slate-500">
            清除
          </button>
          <button onClick={handleConfirm} className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl hover:bg-emerald-600 shadow-lg transition-all font-bold text-xl active:scale-95">
            確認掛號
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onDemo}
        className="fixed right-6 bottom-6 px-5 py-3 rounded-2xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 active:scale-95"
      >
        教學/模擬檢傷（不存檔）
      </button>
    </div>
  );
}