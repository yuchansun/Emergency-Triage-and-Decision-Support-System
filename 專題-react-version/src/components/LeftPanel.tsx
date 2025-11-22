import React, { useState } from 'react';
import ChiefComplaint from './ChiefComplaint';
import SymptomSelection from './SymptomSelection';
import SystemRecommendation from './SystemRecommendation';

interface LeftPanelProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ selectedSymptoms, setSelectedSymptoms, inputText, setInputText }) => {
  const [activeTab, setActiveTab] = useState<'t' | 'a'>('t');
  const [worstSelectedDegree, setWorstSelectedDegree] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <ChiefComplaint
        selectedSymptoms={selectedSymptoms}
        setSelectedSymptoms={setSelectedSymptoms}
        inputText={inputText}
        setInputText={setInputText}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onWorstDegreeChange={setWorstSelectedDegree}
      />
      <SystemRecommendation
        selectedSymptoms={selectedSymptoms}
        inputText={inputText}
        worstSelectedDegree={worstSelectedDegree}
      />
      <SymptomSelection
        selectedSymptoms={selectedSymptoms}
        setSelectedSymptoms={setSelectedSymptoms}
        activeTab={activeTab}
      />
    </div>
  );
};

export default LeftPanel;
