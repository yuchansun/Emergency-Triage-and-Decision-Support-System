import React, { useState, useRef, useEffect } from 'react';

interface PatientData {
  name: string;
  birthDate: string;
  gender: string;
  bed?: string;
  source?: string;
  visitTime?: string;
  medicalId?: string;
  idNumber?: string;
  visitNumber?: string;
  age?: number;
}

interface PatientInfoProps {
  patient: PatientData | null;
}


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


const PatientInfo: React.FC<PatientInfoProps> = ({ patient }) => {

  // ===== 標籤狀態 =====
  const [tags, setTags] = useState({
    tocc: false,
    fever: false,
    isolation: false,
  });

  // ===== TOCC UI 狀態 =====
  const [showTOCCOptions, setShowTOCCOptions] = useState(false);

  // 大傷應變選擇（預設空字串 -> 顯示灰色；選擇後變紅色）
  const [majorIncident, setMajorIncident] = useState<string>("");

  // 新 TOCC 輸入內容（旅遊、職業、接觸史、群聚）
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

  const popupRef = useRef<HTMLDivElement>(null);

  // 切換普通標籤
  const toggleTag = (key: keyof typeof tags) => {
    if (key !== "tocc") { // TOCC 不在這裡處理
      setTags(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // 切換 TOCC 標籤與彈窗
  const toggleTOCC = () => {
    setShowTOCCOptions(prev => !prev);
  };
  // 同步 tags.tocc 顏色
  useEffect(() => {
    setTags(prev => ({ ...prev, tocc: showTOCCOptions }));
  }, [showTOCCOptions]);
  // 點外關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 如果點擊目標在 popup 或 TOCC 按鈕，就不要關閉
      if (
        popupRef.current && !popupRef.current.contains(event.target as Node) &&
        !toccButtonRef.current?.contains(event.target as Node)
      ) {
        setShowTOCCOptions(false);
      }
    };
    if (showTOCCOptions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTOCCOptions]);
  // 用一個 ref 指向 TOCC 按鈕
  const toccButtonRef = useRef<HTMLSpanElement>(null);


  if (!patient) return <div>尚無病患資料</div>;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-content-light dark:border-content-dark bg-background-light/80 dark:bg-background-dark/80 px-10 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="text-primary w-8 h-8">
          <svg fill="none" viewBox="0 0 48 48">
            <path d="M24 4C12.95 4 4 12.95 4 24C4 35.05 12.95 44 24 44C35.05 44 44 35.05 44 24C44 12.95 35.05 4 24 4ZM24 28H16V20H24V14L32 22L24 30V28Z" fill="currentColor"></path>
          </svg>
        </div>
        <h2 className="text-xl font-bold">急診檢傷系統</h2>
      </div>

      {/* 右邊病患資訊 */}
      <div className="flex flex-col items-end gap-1 text-sm text-subtext-light dark:text-subtext-dark">

        {/* 基礎資料 */}
        <div className="flex items-center gap-4">
          <span className="font-medium text-text-light dark:text-text-dark">
            {patient.name || "【未接收病患姓名】"}
          </span>

          <span>
            ({patient.gender || "無性別資料"}, {patient.age ?? "無年齡資料"} 歲)
          </span>

          <span className="h-4 w-px bg-content-dark"></span>

          {patient.medicalId
            ? <span>病歷號: {patient.medicalId}</span>
            : <span className="text-gray-400">病歷號: 278378(自動帶入)</span>
          }

          {patient.idNumber
            ? <span>身分證號: {patient.idNumber}</span>
            : <span className="text-gray-400">身分證號: 無資料</span>
          }

          {patient.visitNumber
            ? <span>就診號: {patient.visitNumber}</span>
            : <span className="text-gray-400">就診號: 00832(自動帶入)</span>
          }
        </div>

        {/* 註記與輸入區 */}
        <div className="flex items-center gap-2 mt-1">
          <span
            style={{ userSelect: "none" }}
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.fever ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-800"
              }`}
            onClick={() => toggleTag("fever")}
          >
            發燒篩檢站
          </span>

          <span
            style={{ userSelect: "none" }}
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.isolation ? "bg-yellow-200 text-yellow-800" : "bg-gray-200 text-gray-800"
              }`}
            onClick={() => toggleTag("isolation")}
          >
            隔離註記
          </span>

          {/* TOCC 標籤 + 彈窗 */}
          <div className="relative inline-block">
            <span
              ref={toccButtonRef}
              style={{ userSelect: "none" }}
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.tocc ? "bg-blue-400 text-white" : "bg-slate-200 text-slate-800"}`}
              onClick={toggleTOCC}
            >
              TOCC
            </span>

            {/* 彈出視窗 */}
            {showTOCCOptions && (
              <div
                ref={popupRef}
                className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-700 p-3 rounded shadow z-20 border border-gray-200 dark:border-gray-600"
              >
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  TOCC 詳細資訊
                </div>

                <div className="flex flex-col gap-3  pr-1">

                  {/* 旅遊史 */}
                  <div className="flex flex-col text-xs gap-1">
                    <label className="text-gray-600 dark:text-gray-300">旅遊史</label>
                    <input
                      type="text"
                      placeholder="請輸入旅遊地區"
                      value={tocc.travel}
                      onChange={(e) => setTocc({ ...tocc, travel: e.target.value })}
                      className="px-2 py-1 border rounded text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={tocc.travelStart || ""}
                        onChange={(e) => setTocc({ ...tocc, travelStart: e.target.value })}
                        className="px-2 py-1 border rounded text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                      />
                      <input
                        type="date"
                        value={tocc.travelEnd || ""}
                        onChange={(e) => setTocc({ ...tocc, travelEnd: e.target.value })}
                        className="px-2 py-1 border rounded text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                      />
                    </div>
                  </div>

                  {/* 職業史 */}
                  <div className="flex flex-col text-xs gap-1">
                    <label className="text-gray-600 dark:text-gray-300">職業史</label>
                    <select
                      value={tocc.occupation}
                      onChange={(e) => setTocc({ ...tocc, occupation: e.target.value })}
                      className="px-2 py-1 border rounded bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                    >
                      <option value="">請選擇</option>
                      <option value="醫護">醫護</option>
                      <option value="教師">教師</option>
                      <option value="服務業">服務業</option>
                      <option value="工廠">工廠</option>
                      <option value="其他">其他</option>
                    </select>
                    {tocc.occupation === "其他" && (
                      <input
                        type="text"
                        placeholder="請輸入職業"
                        value={tocc.occupationOther || ""}
                        onChange={(e) => setTocc({ ...tocc, occupationOther: e.target.value })}
                        className="px-2 py-1 border rounded text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                      />
                    )}
                  </div>

                  {/* 接觸史 */}
                  <div className="flex flex-col text-xs gap-1">
                    <label className="text-gray-600 dark:text-gray-300">接觸史</label>
                    <div className="flex gap-4">
                      {["疾病", "動物"].map((item) => (
                        <div
                          key={item}
                          className={`flex items-center gap-1 px-2 py-1 border rounded cursor-pointer ${tocc.contactItems?.includes(item) ? "bg-blue-400 text-white" : "bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          onClick={() => {
                            const current = tocc.contactItems || [];
                            if (current.includes(item)) {
                              setTocc({ ...tocc, contactItems: current.filter((i) => i !== item) });
                            } else {
                              setTocc({ ...tocc, contactItems: [...current, item] });
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={tocc.contactItems?.includes(item) || false}
                            readOnly
                          />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 群聚 */}
                  <div className="flex flex-col text-xs gap-1">
                    <label className="text-gray-600 dark:text-gray-300">是否群聚</label>
                    <div className="flex flex-wrap gap-2">
                      {["家人", "朋友", "同事", "同學", "其他"].map((item) => (
                        <div
                          key={item}
                          className={`flex items-center gap-1 px-2 py-1 border rounded cursor-pointer ${tocc.clusterItems?.includes(item) ? "bg-blue-400 text-white" : "bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          onClick={() => {
                            const current = tocc.clusterItems || [];
                            if (current.includes(item)) {
                              setTocc({ ...tocc, clusterItems: current.filter((i) => i !== item) });
                            } else {
                              setTocc({ ...tocc, clusterItems: [...current, item] });
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={tocc.clusterItems?.includes(item) || false}
                            readOnly
                          />
                          <span>{item}</span>
                        </div>
                      ))}
                      {tocc.clusterItems?.includes("其他") && (
                        <input
                          type="text"
                          placeholder="請輸入群聚對象"
                          value={tocc.clusterOther || ""}
                          onChange={(e) => setTocc({ ...tocc, clusterOther: e.target.value })}
                          className="px-2 py-1 border rounded text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                        />
                      )}
                    </div>
                  </div>

                  {/* 症狀 */}
                  <div className="flex flex-col text-xs gap-1">
                    <label className="text-gray-600 dark:text-gray-300">症狀</label>
                    <div className="flex gap-4">
                      {["咳嗽", "發燒"].map((item) => (
                        <div
                          key={item}
                          className={`flex items-center gap-1 px-2 py-1 border rounded cursor-pointer ${tocc.symptoms?.includes(item) ? "bg-red-400 text-white" : "bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          onClick={() => {
                            const current = tocc.symptoms || [];
                            if (current.includes(item)) {
                              setTocc({ ...tocc, symptoms: current.filter((i) => i !== item) });
                            } else {
                              setTocc({ ...tocc, symptoms: [...current, item] });
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={tocc.symptoms?.includes(item) || false}
                            readOnly
                          />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* 底部按鈕 */}
                <div className="flex justify-between mt-3">
                  <button
                    className="text-xs text-red-600 underline"
                    onClick={() =>
                      setTocc({
                        travel: "",
                        travelStart: "",
                        travelEnd: "",
                        occupation: "",
                        occupationOther: "",
                        contactItems: [],
                        clusterItems: [],
                        clusterOther: "",
                        symptoms: [],
                      })
                    }
                  >
                    重置
                  </button>

                  <button
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded"
                    onClick={() => setShowTOCCOptions(false)}
                  >
                    確認
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* 病患來源 */}
          <select className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium border border-blue-300">
            <option value="">選擇病患來源</option>
            <option value="急診">急診</option>
            <option value="門診">門診</option>
            <option value="住院">住院</option>
            <option value="其他">其他</option>
          </select>

          {/* 大傷應變 */}
          <select
            value={majorIncident}
            onChange={(e) => setMajorIncident(e.target.value)}
            className={`px-2 py-0.5 rounded text-xs font-medium border ${majorIncident ? 'bg-red-200 text-red-800 border-red-300' : 'bg-blue-100 text-slate-800 border-blue-300'}`}
          >
            <option value="">選擇大傷</option>
            <option value="馬太鞍溪堰塞湖溢流">馬太鞍溪堰塞湖溢流</option>
            <option value="明揚國際屏東廠火災">明揚國際屏東廠火災</option>
            <option value="八仙樂園派對粉塵爆炸事故">八仙樂園派對粉塵爆炸事故</option>
            <option value="其他">其他</option>
          </select>


          {/* 床位 */}
          <input
            type="text"
            placeholder="輸入床位"
            className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium border border-blue-300 w-20"
          />
          {/* 看診時間（自動生成） */}
          <span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">
            看診時間: {new Date().toLocaleString()}
          </span>
        </div>
      </div>
    </header>
  );
};

export default PatientInfo;
