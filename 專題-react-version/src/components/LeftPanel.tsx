import React from 'react';
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
  return (
    <div className="flex flex-col gap-8">
      <ChiefComplaint selectedSymptoms={selectedSymptoms} setSelectedSymptoms={setSelectedSymptoms} inputText={inputText} setInputText={setInputText} />
      <SystemRecommendation selectedSymptoms={selectedSymptoms} inputText={inputText} />
      <SymptomSelection selectedSymptoms={selectedSymptoms} setSelectedSymptoms={setSelectedSymptoms} />
    </div>
  );
};

export default LeftPanel;
