import React, { useState } from 'react';
import { ChiefComplaintMainPanel } from './ChiefComplaint';
import SymptomSelection from './SymptomSelection';
import Vitals, { type VitalsProps } from './Vitals';

type VitalsForm = NonNullable<VitalsProps['vitals']>;

interface LeftPanelProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeTab: 't' | 'a';
  gender?: VitalsProps['gender'];
  age?: number;
  vitals: VitalsForm;
  setVitals: React.Dispatch<React.SetStateAction<VitalsForm>>;
  highlightDrugAllergy?: boolean;
  highlightHistoricalDrugAllergy?: boolean;
  highlightHistoricalPastHistory?: boolean;
  highlightHistoricalDoNotTreat?: boolean;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  selectedSymptoms,
  setSelectedSymptoms,
  activeTab,
  gender,
  age,
  vitals,
  setVitals,
  highlightDrugAllergy,
  highlightHistoricalDrugAllergy,
  highlightHistoricalPastHistory,
  highlightHistoricalDoNotTreat,
}) => {
  const [symptomBodyOpen, setSymptomBodyOpen] = useState(false);

  return (
    <div className={`flex flex-col gap-4 ${highlightDrugAllergy ? 'ring-2 ring-red-300' : ''}`}>
      <ChiefComplaintMainPanel />
      <Vitals
        gender={gender}
        vitals={vitals}
        setVitals={setVitals}
        highlightHistoricalDrugAllergy={highlightHistoricalDrugAllergy}
        highlightHistoricalPastHistory={highlightHistoricalPastHistory}
        highlightHistoricalDoNotTreat={highlightHistoricalDoNotTreat}
      />
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setSymptomBodyOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left font-semibold text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
          aria-expanded={symptomBodyOpen}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">body_system</span>
            選擇症狀（人體圖）
          </span>
          <span className="material-symbols-outlined text-subtext-light dark:text-subtext-dark shrink-0">
            {symptomBodyOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {symptomBodyOpen && (
          <div className="border-t border-gray-100 dark:border-gray-800 p-2 sm:p-4">
            <SymptomSelection
              selectedSymptoms={selectedSymptoms}
              setSelectedSymptoms={setSelectedSymptoms}
              activeTab={activeTab}
              age={age}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftPanel;
