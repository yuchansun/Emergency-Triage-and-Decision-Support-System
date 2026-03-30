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
  age?: number;
  llmMode: 'cloud' | 'local'; //新加
  vitals?: {
    temperature: string;
    heartRate: string;
    spo2: string;
    respRate: string;
    weight: string;
    systolicBP: string;
    diastolicBP: string;
    bloodSugar: string;
    bloodSugarLevel: string | null;
    gcsEye: string | null;
    gcsVerbal: string | null;
    gcsMotor: string | null;
    obHistory: string | null;
    pastHistory: string[];
    drugAllergy: string | null;
    painScore: number | null;
    doNotTreat: string;
    sentiment: number | null;
  };
  onChiefComplaintChange?: (data: {
    selectedRules: Record<string, { 
      degree: number; 
      judge: string; 
      rule_code: string;      // ← 加這個
      symptom_name: string;   // ← 加這個
    }>;
    supplementText: string;
  }) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ selectedSymptoms, setSelectedSymptoms, inputText, setInputText, onWorstDegreeChange, onDirectToER, directToERSelected, age, llmMode, vitals, onChiefComplaintChange }) => {
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
        age={age}
        vitals={vitals}
        onChiefComplaintChange={onChiefComplaintChange}
        llmMode={llmMode} //新加
      />
      <SymptomSelection
        selectedSymptoms={selectedSymptoms}
        setSelectedSymptoms={setSelectedSymptoms}
        activeTab={activeTab}
        age={age}
      />
    </div>
  );
};

export default LeftPanel;
