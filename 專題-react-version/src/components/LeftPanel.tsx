import React, { useState } from 'react';
import ChiefComplaint from './ChiefComplaint';
import SymptomSelection from './SymptomSelection';

interface LeftPanelProps {
  selectedSymptoms: Set<string>;
  setSelectedSymptoms: React.Dispatch<React.SetStateAction<Set<string>>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  onWorstDegreeChange: (degree: number | null) => void;
  onDirectToER: () => void;
  directToERSelected: boolean;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ selectedSymptoms, setSelectedSymptoms, inputText, setInputText, onWorstDegreeChange, onDirectToER, directToERSelected }) => {
  const [activeTab, setActiveTab] = useState<'t' | 'a'>('t');

  return (
    <div className="flex flex-col gap-8">
      <ChiefComplaint
        selectedSymptoms={selectedSymptoms}
        setSelectedSymptoms={setSelectedSymptoms}
        inputText={inputText}
        setInputText={setInputText}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onWorstDegreeChange={onWorstDegreeChange}
        onDirectToER={onDirectToER}
        directToERSelected={directToERSelected}
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
