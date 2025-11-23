import React, { useState } from 'react';

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
}

interface PatientInfoProps {
  patient: PatientData | null;  // 允許 null
}

const PatientInfo: React.FC<PatientInfoProps> = ({ patient }) => {
  // ===== 布林值標籤狀態 =====
  const [tags, setTags] = useState({
    critical: false,
    tocc: false,
    fever: false,
    isolation: false,
  });

  const [showTOCCOptions, setShowTOCCOptions] = useState(false);
  const [toccOptions, setToccOptions] = useState({
    travel: false,
    occupation: false,
    contact: false,
    cluster: false,
  });

  const toggleTag = (key: keyof typeof tags) => {
    setTags({ ...tags, [key]: !tags[key] });
    if (key === 'tocc') setShowTOCCOptions(!showTOCCOptions);
  };

  const toggleToccOption = (key: keyof typeof toccOptions) => {
    setToccOptions({ ...toccOptions, [key]: !toccOptions[key] });
  };

  if (!patient) return <div>尚無病患資料</div>;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-content-light dark:border-content-dark bg-background-light/80 dark:bg-background-dark/80 px-10 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="text-primary w-8 h-8">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4C12.95 4 4 12.95 4 24C4 35.05 12.95 44 24 44C35.05 44 44 35.05 44 24C44 12.95 35.05 4 24 4ZM24 28H16V20H24V14L32 22L24 30V28Z" fill="currentColor"></path>
          </svg>
        </div>
        <h2 className="text-xl font-bold">急診檢傷系統</h2>
      </div>

      {/* 右邊病患資訊 */}
      <div className="flex flex-col items-end gap-1 text-sm text-subtext-light dark:text-subtext-dark">
        {/* 核心病患資訊 */}
        <div className="flex items-center gap-4">
          <span className="font-medium text-text-light dark:text-text-dark">{patient.name}</span>
          <span>({patient.gender}, {patient.birthDate}歲)</span>
          <span className="h-4 w-px bg-content-dark"></span>
          {patient.medicalId && <span>病歷號: {patient.medicalId}</span>}
          {patient.idNumber && <span>身分證號: {patient.idNumber}</span>}
          {patient.visitNumber && <span>就診號: {patient.visitNumber}</span>}
        </div>

        {/* 註記標籤 */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.critical ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'}`}
            onClick={() => toggleTag('critical')}
          >
            大傷
          </span>

          <div className="relative inline-block">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.tocc ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-800'}`}
              onClick={() => toggleTag('tocc')}
            >
              TOCC
            </span>

            {showTOCCOptions && (
              <div className="absolute top-full left-0 mt-1 flex gap-2 bg-white dark:bg-gray-700 p-2 rounded shadow z-20">
                {['旅遊史', '職業史', '接觸史', '是否群聚'].map((item) => (
                  <span
                    key={item}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${toccOptions[item as keyof typeof toccOptions] ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-800'}`}
                    onClick={() => toggleToccOption(item as keyof typeof toccOptions)}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.fever ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}`}
            onClick={() => toggleTag('fever')}
          >
            發燒篩檢站
          </span>

          <span
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.isolation ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'}`}
            onClick={() => toggleTag('isolation')}
          >
            隔離註記
          </span>

          {/* 固定顯示欄位 */}
          {/*patient.bed && */ <span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">床位: 343434{patient.bed}</span>}
          {/*patient.source && */<span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">病患來源: 3434{patient.source}</span>}
          {/*patient.visitTime && */<span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">看診時間: 121{patient.visitTime}</span>}
        </div>
      </div>
    </header>
  );
};

export default PatientInfo;
