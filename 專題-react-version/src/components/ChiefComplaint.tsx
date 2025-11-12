import React, { useState, useMemo } from 'react';

interface ChiefComplaintProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
}

const ChiefComplaint: React.FC<ChiefComplaintProps> = ({ selectedSymptoms, setSelectedSymptoms, inputText, setInputText }) => {
  const [recommendedSymptoms, setRecommendedSymptoms] = useState<string[]>([]);

  // 完整症狀資料庫（包含所有外傷、非外傷、環境症狀）
  const symptomDatabase = useMemo(() => [
    // 外傷症狀
    '頭部鈍傷', '頭部穿刺傷', '頭部撕裂傷、擦傷',
    '顏面部鈍傷', '顏面部穿刺傷', '顏面部撕裂傷、擦傷',
    '眼睛鈍傷', '眼睛穿刺傷', '眼睛撕裂傷、擦傷',
    '鼻子鈍傷', '鼻子穿刺傷', '鼻子撕裂傷、擦傷',
    '耳朵鈍傷', '耳朵穿刺傷', '耳朵撕裂傷、擦傷',
    '頸部鈍傷', '頸部穿刺傷', '頸部撕裂傷、擦傷',
    '胸部鈍傷', '胸部穿刺傷', '胸部撕裂傷、擦傷',
    '腹部鈍傷', '腹部穿刺傷', '腹部撕裂傷、擦傷',
    '上肢鈍傷', '上肢穿刺傷', '上肢撕裂傷、擦傷',
    '腰背部鈍傷', '腰背部穿刺傷', '腰背部撕裂傷、擦傷',
    '會陰部鈍傷', '會陰部穿刺傷', '會陰部撕裂傷、擦傷',
    '下肢鈍傷', '下肢穿刺傷', '下肢撕裂傷、擦傷',
    '燒燙傷', '確定或疑似性侵害', '家庭暴力',
    '皮膚燒燙傷', '顏面部撕裂傷', '上肢撕裂傷', '下肢撕裂傷', '下肢鈍傷', '腰背部撕裂傷',
    
    // 非外傷症狀 - 神經系統
    '中風症狀（突發性口齒不清／單側肢體感覺異常／突發性視覺異常）', '意識程度改變', '抽搐',
    '步態不穩/運動失調', '混亂', '眩暈/頭暈', '肢體無力', '知覺喪失/感覺異常', '震顫', '頭痛',
    
    // 非外傷症狀 - 眼科
    '化學物質暴露眼睛', '畏光／光傷害', '眼眶腫脹', '眼睛內異物', '眼睛分泌物', '眼睛疼痛', '眼睛紅／癢', '視覺障礙',
    
    // 非外傷症狀 - 呼吸系統
    '呼吸停止', '呼吸短促', '呼吸道內異物', '咳嗽', '咳血', '換氣過度', '過敏反應',
    
    // 非外傷症狀 - 耳鼻喉系統
    '上呼吸道感染相關症狀（鼻塞、流鼻水、咳嗽、喉嚨痛）', '吞嚥困難', '喉嚨痛', '流鼻血',
    '牙齒／牙齦問題', '耳內異物', '耳朵分泌物', '耳朵疼痛', '耳鳴', '聽力改變',
    '過敏或非特定因素引起的鼻塞', '頸部腫脹／疼痛', '顏面疼痛（無外傷／無牙齒問題）', '鼻內異物',
    
    // 非外傷症狀 - 心臟血管系統
    '心跳停止', '胸痛', '心悸', '昏厥', '高血壓', '低血壓',
    
    // 非外傷症狀 - 心理健康
    '失眠', '幻覺／妄想', '怪異行為', '憂鬱／自殺', '暴力行為／自傷／攻擊他人', '焦慮／激動', '社會／社交問題',
    
    // 非外傷症狀 - 腸胃系統
    '便秘', '厭食', '吐血', '吞食異物', '噁心/嘔吐', '打嗝', '直腸內異物', '直腸會陰疼痛',
    '腹瀉', '腹痛', '腹部腫塊/腹脹', '血便/黑便', '黃疸', '鼠蹊部疼痛/腫塊',
    
    // 非外傷症狀 - 骨骼系統
    '上肢疼痛', '背痛', '關節腫脹', '下肢疼痛',
    
    // 非外傷症狀 - 泌尿系統
    '多尿', '少尿', '尿滯留', '泌尿道感染相關症狀（頻尿、解尿疼痛）', '生殖器官分泌物／病變',
    '腰痛', '血尿', '陰囊疼痛／腫脹', '陰莖腫脹', '鼠蹊部疼痛／腫塊',
    
    // 非外傷症狀 - 婦產科
    '懷孕問題（大於20週／小於20週）', '月經問題', '產後出血', '確定或疑似性侵害',
    '陰唇腫脹', '陰道內異物', '陰道出血', '陰道分泌物', '陰道疼痛／搔癢',
    
    // 非外傷症狀 - 皮膚系統
    '乳房紅腫', '局部紅腫', '搔癢', '疑似傳染性皮膚病', '發紺', '皮膚內異物',
    '紅疹', '腫塊／結節', '自發性瘀斑', '血液體液曝露',
    
    // 非外傷症狀 - 一般與其他
    '全身倦怠', '發燒', '體重減輕', '不明原因疼痛', '其他未分類症狀',
    '呼吸困難', '頭暈', '意識改變', '嘔吐',
    
    // 環境因素症狀
    '動物咬傷', '蛇咬傷', '化學物質暴露', '中暑/高體溫症', '低體溫症',
    '有毒氣體吸入/暴露', '溺水', '凍傷', '電擊傷害'
  ], []);

  // 搜尋推薦症狀（基於輸入框中的所有關鍵字）
  const searchSymptoms = (text: string) => {
    if (text.length < 1) {
      setRecommendedSymptoms([]);
      return;
    }
    
    // 提取所有可能的關鍵字（包括中文字符、英文單詞）
    const allKeywords = text
      .replace(/[\s\n\r\t,，。！？；：「」『』（）()\[\]{}]/g, ' ') // 替換標點符號為空格
      .split(/\s+/) // 按空格分割
      .filter(keyword => keyword.length > 0) // 移除空字符串
      .flatMap(keyword => {
        // 對於每個關鍵字，也提取單個中文字符
        const chars = keyword.split('').filter(char => /[\u4e00-\u9fff]/.test(char));
        return [keyword, ...chars];
      })
      .filter((keyword, index, array) => array.indexOf(keyword) === index && keyword.length > 0); // 去重
    
    if (allKeywords.length === 0) {
      setRecommendedSymptoms([]);
      return;
    }
    
    const matches = symptomDatabase.filter(symptom => {
      // 檢查是否已經選中（任何前綴）
      const isAlreadySelected = Array.from(selectedSymptoms).some(selected => {
        const cleanSelected = selected.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
        return cleanSelected === symptom;
      });
      
      if (isAlreadySelected) return false;
      
      // 檢查是否包含任一關鍵字（OR邏輯，而非AND）
      return allKeywords.some(keyword => 
        symptom.toLowerCase().includes(keyword.toLowerCase())
      );
    })
    .sort((a, b) => {
      // 按匹配的關鍵字數量排序（匹配更多關鍵字的排在前面）
      const aMatches = allKeywords.filter(keyword => 
        a.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      const bMatches = allKeywords.filter(keyword => 
        b.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      return bMatches - aMatches;
    })
    .slice(0, 10); // 增加到10個推薦
    
    setRecommendedSymptoms(matches);
  };

  // 處理輸入變化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    // 即時搜尋，無論是新輸入還是繼續輸入
    searchSymptoms(text);
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Enter 鍵不清空輸入，保持搜尋狀態
      searchSymptoms(inputText);
    }
  };

  // 添加推薦症狀
  const addRecommendedSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => new Set([...prev, `manual:${symptom}`]));
    // 重新搜尋以更新推薦列表（移除剛選的症狀）
    searchSymptoms(inputText);
  };

  // 移除症狀
  const removeSymptom = (symptomKey: string) => {
    setSelectedSymptoms(prev => {
      const next = new Set(prev);
      next.delete(symptomKey);
      return next;
    });
    // 重新搜尋以更新推薦列表（可能重新顯示剛移除的症狀）
    if (inputText.trim()) {
      setTimeout(() => searchSymptoms(inputText), 0);
    }
  };

  // 將選中的症狀轉換為可讀的標籤
  const symptomTags = useMemo(() => {
    return Array.from(selectedSymptoms).map(key => {
      // 移除前綴（如 't:', 'emerg:', 'manual:' 等）
      const cleanKey = key.replace(/^[^:]+:/, '').replace(/^[^:]+:/, '');
      return { key, display: cleanKey };
    });
  }, [selectedSymptoms]);

  return (
    <div className="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold flex items-center gap-2">主訴</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setSelectedSymptoms(prev => new Set([...prev, 'emerg:cardiac_arrest']))}
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${
              selectedSymptoms.has('emerg:cardiac_arrest') ? 'selected' : ''
            }`}
          >
            <span className="material-symbols-outlined text-sm">cardiology</span>
            <span>心跳停止</span>
          </button>
          <button 
            onClick={() => setSelectedSymptoms(prev => new Set([...prev, 'emerg:direct_to_er']))}
            className={`symptom-option-btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ${
              selectedSymptoms.has('emerg:direct_to_er') ? 'selected' : ''
            }`}
          >
            <span className="material-symbols-outlined text-sm">emergency</span>
            <span>直入急救室</span>
          </button>
        </div>
      </div>
      
      {/* 輸入區域 */}
      <div className="relative mb-4">
        <textarea 
          className="form-textarea w-full min-h-[100px] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark p-4 focus:ring-primary focus:border-primary resize-none" 
          id="symptoms-detail" 
          placeholder="請輸入患者主訴症狀，系統會根據所有關鍵字持續推薦相關症狀（如：患者主訴頭痛，昨天開始胸悶...）" 
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <button className="absolute bottom-3 right-3 flex items-center justify-center size-10 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
          <span className="material-symbols-outlined">mic</span>
        </button>
      </div>

      {/* 推薦症狀 */}
      {recommendedSymptoms.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="text-sm font-semibold text-primary mb-2">推薦症狀</h4>
          <div className="flex flex-wrap gap-2">
            {recommendedSymptoms.map(symptom => (
              <button
                key={symptom}
                onClick={() => addRecommendedSymptom(symptom)}
                className="px-3 py-1 text-sm bg-white border border-primary/30 text-primary rounded-full hover:bg-primary/10 transition-colors"
              >
                + {symptom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 已選症狀標籤 */}
      {symptomTags.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">已選症狀</h4>
          <div className="flex flex-wrap gap-2">
            {symptomTags.map(({ key, display }) => (
              <div
                key={key}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-sm rounded-full"
              >
                <span>{display}</span>
                <button
                  onClick={() => removeSymptom(key)}
                  className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  title="移除症狀"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-subtext-light dark:text-subtext-dark">💡 系統會自動分析主訴中的所有關鍵字並持續推薦相關症狀，無論游標位置在哪裡。點擊症狀標籤的 ✕ 可移除。包含所有外傷、非外傷、環境症狀。</p>
    </div>
  );
};

export default ChiefComplaint;
