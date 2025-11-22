import React, { useState, useMemo, useEffect } from 'react';

interface SystemRecommendationProps {
  selectedSymptoms: Set<string>;
  inputText: string;
  worstSelectedDegree: number | null;
}

const SystemRecommendation: React.FC<SystemRecommendationProps> = ({ selectedSymptoms, inputText, worstSelectedDegree }) => {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  
  // 根據症狀和輸入文字動態計算推薦級數（簡單模型，之後會替換為AI模型）
  const systemRecommendedLevel = useMemo(() => {
    // 若有來自判斷規則的最嚴重級數，優先使用
    if (worstSelectedDegree !== null) {
      return worstSelectedDegree;
    }

    // 如果沒有輸入主訴且沒有選中症狀，不顯示推薦
    if (!inputText.trim() && selectedSymptoms.size === 0) {
      return null;
    }

    let score = 4; // 預設為第4級（次緊急）

    // 根據緊急症狀調整級數
    const emergencySymptoms = Array.from(selectedSymptoms).filter(symptom => 
      symptom.includes('emerg:cardiac_arrest') || 
      symptom.includes('emerg:direct_to_er') ||
      symptom.includes('心跳停止') ||
      symptom.includes('直入急救室') ||
      symptom.includes('意識改變')
    );
    
    if (emergencySymptoms.length > 0) {
      score = 1; // 緊急症狀 -> 第1級
    } else {
      // 根據主訴關鍵字調整
      const criticalKeywords = ['噴血', '胸痛', '呼吸困難', '昏厥', '心悸'];
      const urgentKeywords = ['頭痛', '發燒', '腹痛', '嘔吐'];
      const moderateKeywords = ['咳嗽', '流鼻水', '喉嚨痛'];
      
      const hasCritical = criticalKeywords.some(keyword => inputText.includes(keyword));
      const hasUrgent = urgentKeywords.some(keyword => inputText.includes(keyword));
      const hasModerate = moderateKeywords.some(keyword => inputText.includes(keyword));
      
      if (hasCritical || selectedSymptoms.size >= 3) {
        score = 2; // 第2級
      } else if (hasUrgent || selectedSymptoms.size >= 2) {
        score = 3; // 第3級
      } else if (hasModerate || selectedSymptoms.size >= 1) {
        score = 4; // 第4級
      }
    }
    return score;
  }, [worstSelectedDegree, selectedSymptoms, inputText]);

  useEffect(() => {
    if (systemRecommendedLevel !== null) {
      setSelectedLevel(systemRecommendedLevel);
    }
  }, [systemRecommendedLevel]);

  const handleLevelSelect = (level: number) => {
    setSelectedLevel(level);
  };

  // 獲取級數對應的顏色和名稱
  const getLevelInfo = (level: number) => {
    const levelMap = {
      1: { color: 'text-red-500', bgColor: 'bg-red-500', name: '復甦急救', icon: 'emergency' },
      2: { color: 'text-orange-500', bgColor: 'bg-orange-500', name: '緊急', icon: 'warning' },
      3: { color: 'text-yellow-500', bgColor: 'bg-yellow-500', name: '緊迫', icon: 'priority_high' },
      4: { color: 'text-green-500', bgColor: 'bg-green-500', name: '次緊急', icon: 'schedule' },
      5: { color: 'text-blue-500', bgColor: 'bg-blue-500', name: '非緊急', icon: 'check_circle' }
    };
    return levelMap[level as keyof typeof levelMap] || levelMap[5];
  };

  const handleConfirm = () => {
    if (selectedLevel) {
      // 這裡可以添加送出資料的邏輯
      alert(`確定級數：第${selectedLevel}級`);
      console.log('確定級數：', selectedLevel);
    } else {
      alert('請先選擇級數');
    }
  };

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">recommend</span>
            系統推薦分類：
          </h3>
          {systemRecommendedLevel ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
              <div className={`w-8 h-8 rounded-full ${getLevelInfo(systemRecommendedLevel).bgColor} flex items-center justify-center`}>
                <span className="font-bold text-white text-sm">
                  {systemRecommendedLevel}
                </span>
              </div>
              <span className={`font-semibold text-sm ${getLevelInfo(systemRecommendedLevel).color}`}>
                {getLevelInfo(systemRecommendedLevel).name}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">
              請輸入主訴或選擇症狀以獲得推薦
            </span>
          )}
        </div>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          確定級數
        </button>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <button 
          type="button" 
          onClick={() => handleLevelSelect(1)}
          className={`level-btn p-3 rounded-lg border-2 text-center transition-colors ${
            selectedLevel === 1 
              ? 'border-red-500 bg-red-500 text-white' 
              : 'border-red-500 bg-red-500/5 hover:bg-red-500/10 dark:hover:bg-red-500/20'
          }`}
        >
          <h4 className={`font-bold text-sm mb-1 ${
            selectedLevel === 1 ? 'text-white' : 'text-red-500'
          }`}>第一級</h4>
          <h5 className={`font-semibold text-xs ${
            selectedLevel === 1 ? 'text-white' : 'text-red-500'
          }`}>復甦急救</h5>
        </button>
        <button 
          type="button" 
          onClick={() => handleLevelSelect(2)}
          className={`level-btn p-3 rounded-lg border-2 text-center transition-colors ${
            selectedLevel === 2 
              ? 'border-orange-500 bg-orange-500 text-white' 
              : 'border-orange-500 bg-orange-500/5 hover:bg-orange-500/10 dark:hover:bg-orange-500/20'
          }`}
        >
          <h4 className={`font-bold text-sm mb-1 ${
            selectedLevel === 2 ? 'text-white' : 'text-orange-500'
          }`}>第二級</h4>
          <h5 className={`font-semibold text-xs ${
            selectedLevel === 2 ? 'text-white' : 'text-orange-500'
          }`}>緊急</h5>
        </button>
        <button 
          type="button" 
          onClick={() => handleLevelSelect(3)}
          className={`level-btn p-3 rounded-lg border-2 text-center transition-colors ${
            selectedLevel === 3 
              ? 'border-yellow-500 bg-yellow-500 text-white' 
              : 'border-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10 dark:hover:bg-yellow-500/20'
          }`}
        >
          <h4 className={`font-bold text-sm mb-1 ${
            selectedLevel === 3 ? 'text-white' : 'text-yellow-500'
          }`}>第三級</h4>
          <h5 className={`font-semibold text-xs ${
            selectedLevel === 3 ? 'text-white' : 'text-yellow-500'
          }`}>緊迫</h5>
        </button>
        <button 
          type="button" 
          onClick={() => handleLevelSelect(4)}
          className={`level-btn p-3 rounded-lg border-2 text-center transition-colors ${
            selectedLevel === 4 
              ? 'border-green-500 bg-green-500 text-white' 
              : 'border-green-500 bg-green-500/5 hover:bg-green-500/10 dark:hover:bg-green-500/20'
          }`}
        >
          <h4 className={`font-bold text-sm mb-1 ${
            selectedLevel === 4 ? 'text-white' : 'text-green-500'
          }`}>第四級</h4>
          <h5 className={`font-semibold text-xs ${
            selectedLevel === 4 ? 'text-white' : 'text-green-500'
          }`}>次緊急</h5>
        </button>
        <button 
          type="button" 
          onClick={() => handleLevelSelect(5)}
          className={`level-btn p-3 rounded-lg border-2 text-center transition-colors ${
            selectedLevel === 5 
              ? 'border-blue-500 bg-blue-500 text-white' 
              : 'border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 dark:hover:bg-blue-500/20'
          }`}
        >
          <h4 className={`font-bold text-sm mb-1 ${
            selectedLevel === 5 ? 'text-white' : 'text-blue-500'
          }`}>第五級</h4>
          <h5 className={`font-semibold text-xs ${
            selectedLevel === 5 ? 'text-white' : 'text-blue-500'
          }`}>非緊急</h5>
        </button>
      </div>
    </div>
  );
};

export default SystemRecommendation;
