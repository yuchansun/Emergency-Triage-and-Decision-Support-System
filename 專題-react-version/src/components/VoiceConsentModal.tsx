import React, { useState } from 'react';

interface VoiceConsentModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onDisagree: () => void;
}

const VoiceConsentModal: React.FC<VoiceConsentModalProps> = ({ isOpen, onAgree, onDisagree }) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999]">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">mic</span>
            語音錄音同意書
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-96 overflow-y-auto">
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <p className="font-semibold mb-2">📋 同意事項：</p>
              <ul className="list-disc list-inside space-y-2 text-xs">
                <li>您同意本系統將錄製您的語音輸入內容</li>
                <li>錄製的語音將被轉換成文字逐字稿</li>
                <li>逐字稿將用於患者主訴記錄和系統分析</li>
                <li>所有錄音數據將按照隱私政策安全儲存</li>
              </ul>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="font-semibold mb-2">⚠️ 注意事項：</p>
              <ul className="list-disc list-inside space-y-2 text-xs">
                <li>如不同意此協議，您將無法使用語音輸入功能</li>
                <li>您可以繼續使用文字輸入進行檢傷</li>
                <li>如需更改設定，請在檢傷介面設定中修改</li>
              </ul>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="mt-1 rounded"
                />
                <span className="text-xs">
                  我已閱讀以上內容，並同意本系統錄製和儲存逐字稿
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onDisagree}
            className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 font-semibold transition-colors"
          >
            不同意
          </button>
          <button
            onClick={onAgree}
            disabled={!isChecked}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
              isChecked
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            同意
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceConsentModal;
