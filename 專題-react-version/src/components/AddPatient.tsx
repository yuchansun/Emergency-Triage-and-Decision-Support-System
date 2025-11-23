import { useState } from "react";

export default function AddPatient({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [medicalNumber, setMedicalNumber] = useState("");
  const [gender, setGender] = useState<"男" | "女" | "不詳" | "">("");
  const [icCard, setIcCard] = useState(false);
  const [search, setSearch] = useState(false);
  const [fallingPatient, setFallingPatient] = useState(false);
  const [idUnknown, setIdUnknown] = useState(false);
  const [birthUnknown, setBirthUnknown] = useState(false);
  const [tsmcTransfer, setTsmcTransfer] = useState(false);

  // 讀 IC 卡
  const handleReadICCard = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/");
      const data = await res.json();

      if (!data || data.length === 0) {
        alert("未偵測到健保卡，請確認已插入讀卡機！");
        return;
      }

      const card = data[0];

      // 塞入資料
      setName(card.full_name || "");
      setIdNumber(card.id_no || "");
      setBirthDate(card.birth_date || "");

      const sexConvert = card.sex === "M" ? "男" : card.sex === "F" ? "女" : "不詳";
      setGender(sexConvert);

      alert("已成功讀取 IC 卡資料！");
    } catch (error) {
      console.error(error);
      alert("讀取 IC 卡失敗，請確認服務是否正在執行。");
    }
  };

  const handleClear = () => {
    setName("");
    setIdNumber("");
    setBirthDate("");
    setMedicalNumber("");
    setGender("");
    setIcCard(false);
    setSearch(false);
    setFallingPatient(false);
    setIdUnknown(false);
    setBirthUnknown(false);
    setTsmcTransfer(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-700">
          新增病患資料
        </h1>

        <div className="flex gap-4 mb-4">
          <button
            type="button"
            className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300 transition"
            onClick={() => {
              setIcCard(!icCard);
              handleReadICCard(); // ← 點 IC 卡時讀資料
            }}
          >
            IC卡
          </button>

          <button
            type="button"
            className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300 transition"
            onClick={() => setSearch(!search)}
          >
            搜尋
          </button>
        </div>

        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
            className="flex-1 border rounded-lg px-4 py-2"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fallingPatient}
              onChange={() => setFallingPatient(!fallingPatient)}
            />
            路倒病人
          </label>

          <input
            type="text"
            value={medicalNumber}
            onChange={(e) => setMedicalNumber(e.target.value)}
            placeholder="病歷號"
            className="flex-1 border rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="身分證號"
            className="flex-1 border rounded-lg px-4 py-2"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={idUnknown}
              onChange={() => setIdUnknown(!idUnknown)}
            />
            身分證不詳
          </label>

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "男" | "女" | "不詳" | "")}
            className="border rounded-lg px-4 py-2"
          >
            <option value="">性別</option>
            <option value="男">男</option>
            <option value="女">女</option>
            <option value="不詳">不詳</option>
          </select>
        </div>

        <div className="flex gap-4 mb-4">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="flex-1 border rounded-lg px-4 py-2"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={birthUnknown}
              onChange={() => setBirthUnknown(!birthUnknown)}
            />
            出生不詳
          </label>
        </div>

        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={tsmcTransfer}
              onChange={() => setTsmcTransfer(!tsmcTransfer)}
            />
            泰山檢疫所法傳轉入
          </label>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 bg-gray-300 py-3 rounded-lg hover:bg-gray-400 transition"
          >
            清除
          </button>

          <button
            type="button"
            onClick={onNext}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
