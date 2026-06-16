import { useState } from "react";
import { getApiBaseUrl, getNhicardBaseUrl } from "../config/serviceUrls";

const API_BASE = getApiBaseUrl();
const NHICARD_BASE = getNhicardBaseUrl();

//定義病人資料結構
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
  drugAllergy?: string | null;
  pastMedicalHistory?: string | null;
  doNotTreat?: string | null;
  isReturning?: boolean;
}

//病人資料輸入與掛號流程
export default function AddPatient({
  onNext,
  onDemo,
  nurseId, 
}: {
  onNext: (data: PatientData) => void;
  onDemo: (data: PatientData) => void;
  nurseId?: string | null; 
}) {
  const [name, setName] = useState("");

  const handleDemo = async () => {
    try {
      const response = await fetch(`${API_BASE}/patients/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "教學測試病患",
          id_number: `DEMO-${Date.now()}`,
          birth_date: "1900-01-01",
          gender: "U",
          drug_allergy: null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.patient_id) {
        throw new Error(result.detail || "建立教學病患失敗");
      }

      onDemo({
        name: "教學測試病患",
        idNumber: "(教學)",
        birthDate: "1900-01-01",
        triage_id: "",
        gender: "",
        icCard: false,
        patient_id: result.patient_id,
        age: 11,
        drugAllergy: null,
      });
    } catch (error) {
      console.error(error);
      alert("建立教學病患失敗，請稍後再試");
    }
  };
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"男" | "女" | "不詳" | "">("");
  const [icCard, setIcCard] = useState(false);
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null);
  const [drugAllergy, setDrugAllergy] = useState<string | null>(null);
  const [pastMedicalHistory, setPastMedicalHistory] = useState<string | null>(null);
  const [doNotTreat, setDoNotTreat] = useState<string | null>(null);
  const [directErModal, setDirectErModal] = useState<{
    patientId: string;
    wristbandSuffix: string;
  } | null>(null);

  // 1. 自動搜尋現有病人 (手打身分證後觸發)
  const checkPatient = async (id: string) => {
    const lookupId = id.trim().toUpperCase();
    setIdNumber(lookupId);
    if (!lookupId || lookupId.length < 4) return;
    try {
      const res = await fetch(`${API_BASE}/patients/search/${lookupId}`);
      const result = await res.json();
      if (res.ok && result.success && result.data) {
        const p = result.data;
        setName(p.name);
        setBirthDate(p.birth_date || "");
        setGender(p.gender === "M" ? "男" : p.gender === "F" ? "女" : "不詳");
        setExistingPatientId(p.patient_id);
        setDrugAllergy(p.drug_allergy ?? null);
        setPastMedicalHistory(p.past_medical_history ?? null);
        setDoNotTreat(p.do_not_treat ?? null);
      } else {
        setExistingPatientId(null);
        setDrugAllergy(null);
        setPastMedicalHistory(null);
        setDoNotTreat(null);
      }
    } catch (e) {
      setExistingPatientId(null);
      console.log("新病人");
    }
  };

  // 2. IC 卡讀取
  const handleReadICCard = async () => {
    try {
      const res = await fetch(`${NHICARD_BASE}/`);
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
    setDrugAllergy(null);
    setPastMedicalHistory(null);
    setDoNotTreat(null);
  };

  const registerPatient = async (directToER: boolean) => {
    try {
      const normalizedIdNumber = idNumber.trim().toUpperCase();
      // Step A: 儲存病人
      const pResponse = await fetch(`${API_BASE}/patients/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          patient_id: existingPatientId, 
          name: name || "不詳", 
          id_number: normalizedIdNumber || null, 
          birth_date: birthDate || null, 
          gender: gender === "男" ? "M" : gender === "女" ? "F" : "U",
          drug_allergy: drugAllergy,
        }),
      });
      const pResult = await pResponse.json();
      if (!pResult.patient_id) throw new Error("病人存檔失敗");

      // Step B: 建立檢傷紀錄 
      // 注意：這裡傳送的結構必須符合你那個複雜的後端 triagesave.py
      const tResponse = await fetch(`${API_BASE}/triagesave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          directToER
            ? {
                patientId: pResult.patient_id,
                nurseId: nurseId || "1",
                selectedLevel: 1,
                vitals: {},
                result: {
                  selectedLevel: 1,
                  rule_code: "R00000",
                  chief_complaint: "直入急救室",
                },
                bed: "",
                patientSource: "直入急救室",
                majorIncident: "否",
                visitTime: new Date().toISOString(),
                directToER: true,
              }
            : {
                patientId: pResult.patient_id,
                nurseId: nurseId || "1",
                vitals: {},
                result: {},
                bed: "",
                patientSource: "自行就醫",
                majorIncident: "否",
                visitTime: new Date().toISOString(),
                directToER: false,
              }
        ),
      });
      const tResult = await tResponse.json();

      if (tResult.success) {
        if (directToER) {
          const wristbandSuffix = String(pResult.patient_id).slice(-5);
          setDirectErModal({
            patientId: String(pResult.patient_id),
            wristbandSuffix,
          });
          return;
        }

        const statusMsg = pResult.is_returning ? "【回診】" : "【初診】";
        alert(`掛號成功！${statusMsg}\n編號: ${tResult.triageId}`);
        onNext({
          name,
          idNumber,
          birthDate,
          triage_id: tResult.triageId,
          gender,
          icCard,
          patient_id: pResult.patient_id,
          drugAllergy,
          pastMedicalHistory,
          doNotTreat,
          isReturning: Boolean(pResult.is_returning),
        });
      } else {
        alert("掛號失敗：" + tResult.detail);
      }
    } catch (error) {
      console.error(error);
      alert("連線失敗，請檢查後端 Terminal 報錯訊息");
    }
  };

  // 3. 確認掛號
  const handleConfirm = async () => {
    await registerPatient(false);
  };

  const handleDirectToER = async () => {
    await registerPatient(true);
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
          <button onClick={handleConfirm} className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl hover:bg-emerald-600 shadow-lg transition-all font-bold text-xl active:scale-95">
            確認掛號
          </button>
        </div>
        <div className="mt-4">
          <button onClick={handleDirectToER} className="w-full bg-red-600 text-white py-4 rounded-2xl hover:bg-red-700 shadow-lg transition-all font-bold text-xl active:scale-95">
            直入急救室
          </button>
        </div>
      </div>

      {directErModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-slate-800">✅ 直入急救室 - 掛號成功</h2>
            <div className="mt-3 border-t border-gray-200 pt-4 space-y-4">
              <div>
                <div className="text-sm text-slate-500">病歷號</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-800 tracking-wide">
                  {directErModal.patientId}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">手環號碼（後五碼）</div>
                <div className="mt-1 text-4xl font-extrabold text-red-600 tracking-wider">
                  {directErModal.wristbandSuffix}
                </div>
              </div>
              <div className="text-sm text-amber-700 leading-relaxed">
                ⚠ 請護理師將手環號碼
                <br />
                記錄於病患手環以利辨識
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirectErModal(null);
                  handleClear();
                }}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition font-bold"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleDemo}
        className="fixed right-6 bottom-6 px-5 py-3 rounded-2xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 active:scale-95"
      >
        教學/模擬檢傷
      </button>
    </div>
  );
}