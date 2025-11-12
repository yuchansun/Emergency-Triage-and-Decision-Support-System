import React, { useState } from 'react';


const PatientInfo: React.FC = () => {
  // ===== 布林值標籤狀態 =====
  // 初始都是 false → 顯示灰色
  const [tags, setTags] = useState({
    critical: false, // 大傷
    tocc: false,     // TOCC
    fever: false,    // 發燒篩檢站
    isolation: false // 隔離註記
  });
  // TOCC 展開勾選列表的控制
  const [showTOCCOptions, setShowTOCCOptions] = useState(false);
  // 切換布林值標籤
  const toggleTag = (key: keyof typeof tags) => {
    setTags({ ...tags, [key]: !tags[key] });
    // 如果點 TOCC，控制展開列表
    if (key === 'tocc') setShowTOCCOptions(!showTOCCOptions);
  };
  const [toccOptions, setToccOptions] = useState({
    travel: false,   // 旅遊史
    occupation: false, // 職業史
    contact: false,    // 接觸史
    cluster: false     // 是否群聚
  });

  const toggleToccOption = (key: keyof typeof toccOptions) => {
    setToccOptions({ ...toccOptions, [key]: !toccOptions[key] });
  };

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
          <span className="font-medium text-text-light dark:text-text-dark">王大明</span>
          <span>(女, 35歲)</span>
          <span className="h-4 w-px bg-content-dark"></span>
          <span>病歷號: 12345</span>
          <span>身分證號: A123456789</span>
          <span>就診號: 20251112-001</span>
        </div>

        {/* 註記標籤 */}
        <div className="flex items-center gap-2 mt-1">
          {/* ===== 布林值標籤：點擊切換灰色 ↔ 彩色 ===== */}
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.critical ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'
              }`}
            onClick={() => toggleTag('critical')} // 點擊切換
          >
            大傷
          </span>

          <div className="relative inline-block">
            {/* TOCC 標籤 */}
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.tocc ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-800'
                }`}
              onClick={() => {
                setShowTOCCOptions(!showTOCCOptions);           // 展開/收合浮層
                toggleTag('tocc'); // 切換 TOCC 顏色
              }}
            >
              TOCC
            </span>

            {/* 絕對定位的 TOCC 選項 */}
            {showTOCCOptions && (
              <div className="absolute top-full left-0 mt-1 flex gap-2 bg-white dark:bg-gray-700 p-2 rounded shadow z-20">
                {['旅遊史', '職業史', '接觸史', '是否群聚'].map((item) => (
                  <span
                    key={item}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${toccOptions[item as keyof typeof toccOptions] ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-800'
                      }`}
                    onClick={() => toggleToccOption(item as keyof typeof toccOptions)}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.fever ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'
              }`}
            onClick={() => toggleTag('fever')}
          >
            發燒篩檢站
          </span>

          <span
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${tags.isolation ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'
              }`}
            onClick={() => toggleTag('isolation')}
          >
            隔離註記
          </span>

          {/* ===== 固定顯示欄位（帶入資料） ===== */}
          <span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">
            床位: 12B
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">
            病患來源: 急診
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-100 text-slate-800 text-xs font-medium">
            看診時間: 11:30
          </span>
        </div>

      </div>

    </header>
  );
};

export default PatientInfo;
