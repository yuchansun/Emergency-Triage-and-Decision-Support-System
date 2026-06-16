/**
 * 發表展示模式（方法 B）：僅在 VITE_PRESENTATION_MODE=true 且主訴關鍵字命中時，
 * 對兩個預設情境保底推薦症狀與判斷規則；其餘檢傷流程不受影響。
 */

export const PRESENTATION_MODE =
  import.meta.env.VITE_PRESENTATION_MODE === 'true' ||
  import.meta.env.VITE_PRESENTATION_MODE === '1';

export type PresentationScenarioId = 'cough_dyspnea' | 'ems_trauma';

export interface PresentationRuleTarget {
  symptomName: string;
  mustRuleCode: string;
  /** 用於從 triage 資料比對 judge_name（部分匹配即可） */
  mustJudgeIncludes: string;
  decoyRuleCodes: string[];
}

export interface PresentationScenario {
  id: PresentationScenarioId;
  match: (text: string) => boolean;
  summary: string;
  activeTab: 'a' | 't';
  /** 一定會出現在推薦症狀列表（靠前） */
  mustSymptoms: string[];
  /** 真實誘餌症狀，讓列表看起來像 AI 推了多個選項 */
  decoySymptoms: string[];
  ruleTargets: PresentationRuleTarget[];
  /** 一鍵統整後，顯示統整主訴前的等待（模擬 LLM 整理） */
  summarizeDelayMs: number;
  /** 統整主訴出現後，再等多久顯示推薦症狀 */
  symptomsDelayAfterSummaryMs: number;
  rulesDelayMs: number;
}

/** 情境一：咳嗽、多痰、呼吸喘（中／英文語音皆可觸發） */
const matchesCoughDyspnea = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  const hasCough =
    /咳嗽|咳痰|很多痰|痰多|有痰/.test(t) ||
    /\bcough/i.test(t) ||
    /phlegm|sputum|mucus/i.test(t);
  const hasDyspnea =
    /喘|呼吸.*急|呼吸越來越|呼吸困難/.test(t) ||
    /dyspnea|shortness of breath|breath.*(worse|difficult|hard)/i.test(t);
  if (hasCough && hasDyspnea) return true;
  // 發表展示保底：語音常只辨識到後半段（喘＋時間），仍觸發情境一
  if (PRESENTATION_MODE && hasDyspnea && /two days|past two|getting worse|for a week|一週|week/i.test(t)) {
    return true;
  }
  return false;
};

/** 情境二：119 機車自撞，救護人員與護理師、病人對話（語音辨識全文） */
const matchesEmsTrauma = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  const hasEmsContext = /119|救護|分隔島|機車.*撞|自撞/.test(t);
  const hasInjury =
    /頭.*(痛|擦傷|流血)|手.*(痛|穿刺|流血)|右手.*穿刺|穿刺傷/.test(t);
  return hasEmsContext && hasInjury;
};

export const PRESENTATION_SCENARIOS: PresentationScenario[] = [
  {
    id: 'cough_dyspnea',
    match: matchesCoughDyspnea,
    summary: '咳嗽、痰多一週，這兩天呼吸越來越喘',
    activeTab: 'a',
    mustSymptoms: ['呼吸短促'],
    decoySymptoms: ['咳嗽', '發燒/畏寒', '咳血'],
    ruleTargets: [
      {
        symptomName: '呼吸短促',
        mustRuleCode: 'A010110',
        mustJudgeIncludes: '輕度呼吸窘迫',
        decoyRuleCodes: ['A010104', 'A010112'],
      },
    ],
    summarizeDelayMs: 7000,
    symptomsDelayAfterSummaryMs: 5000,
    rulesDelayMs: 6000,
  },
  {
    id: 'ems_trauma',
    match: matchesEmsTrauma,
    summary:
      '21歲女性，機車自撞。頭部擦傷流血、右手穿刺傷，訴頭痛手痛，伴頭暈',
    activeTab: 't',
    mustSymptoms: ['上肢鈍傷'],
    decoySymptoms: ['頭部鈍傷', '頭部撕裂傷、擦傷', '上肢穿刺傷'],
    ruleTargets: [
      {
        symptomName: '上肢鈍傷',
        mustRuleCode: 'T120110',
        mustJudgeIncludes: '開放性骨折',
        decoyRuleCodes: ['T120114', 'T120116'],
      },
    ],
    summarizeDelayMs: 7000,
    symptomsDelayAfterSummaryMs: 5000,
    rulesDelayMs: 6000,
  },
];

export function detectPresentationScenario(text: string): PresentationScenario | null {
  if (!PRESENTATION_MODE || !text.trim()) return null;
  for (const scenario of PRESENTATION_SCENARIOS) {
    if (scenario.match(text)) return scenario;
  }
  return null;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export interface TriageRuleRow {
  symptom_name: string;
  rule_code: string;
  judge_name: string;
  ttas_degree: string;
  system_code?: string;
}

export function buildPresentationSymptomList(
  scenario: PresentationScenario,
  alreadySelected: Set<string>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string) => {
    if (!name || seen.has(name) || alreadySelected.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  for (const name of scenario.mustSymptoms) add(name);
  for (const name of scenario.decoySymptoms) add(name);
  return out.slice(0, 5);
}

export function buildPresentationRules(
  scenario: PresentationScenario,
  selectedSymptoms: string[],
  triageRows: TriageRuleRow[],
  age?: number
): Array<{
  rule_code: string;
  symptom_name: string;
  judge_name: string;
  ttas_degree: number;
}> {
  const isAdult = age === undefined ? true : age >= 18;
  const rowByCode = new Map<string, TriageRuleRow>();
  for (const row of triageRows) {
    const code = row.rule_code || '';
    if (!code || rowByCode.has(code)) continue;
    if (row.system_code?.startsWith('A') && !isAdult) continue;
    if (row.system_code?.startsWith('P') && isAdult) continue;
    rowByCode.set(code, row);
  }

  const toRule = (row: TriageRuleRow) => ({
    rule_code: row.rule_code,
    symptom_name: row.symptom_name,
    judge_name: row.judge_name,
    ttas_degree: parseInt(row.ttas_degree, 10),
  });

  const out: ReturnType<typeof toRule>[] = [];
  const seenFp = new Set<string>();

  for (const symptom of selectedSymptoms) {
    const target = scenario.ruleTargets.find(t => t.symptomName === symptom);
    if (!target) continue;

    const mustRow =
      rowByCode.get(target.mustRuleCode) ??
      triageRows.find(
        r =>
          r.symptom_name === target.symptomName &&
          r.rule_code === target.mustRuleCode
      ) ??
      triageRows.find(
        r =>
          r.symptom_name === target.symptomName &&
          (r.judge_name || '').includes(target.mustJudgeIncludes)
      );

    const pushRow = (row: TriageRuleRow | undefined) => {
      if (!row) return;
      const fp = `${row.ttas_degree}::${row.judge_name}`;
      if (seenFp.has(fp)) return;
      seenFp.add(fp);
      out.push(toRule(row));
    };

    pushRow(mustRow);

    for (const code of target.decoyRuleCodes) {
      if (out.filter(r => r.symptom_name === symptom).length >= 3) break;
      const decoy = rowByCode.get(code);
      if (decoy && decoy.symptom_name === symptom) {
        pushRow(decoy);
      }
    }

    // 若誘餌 rule_code 在 DB 對不到，從同症狀補 2 條真實規則
    const forSymptom = out.filter(r => r.symptom_name === symptom);
    if (forSymptom.length < 3) {
      for (const row of triageRows) {
        if (row.symptom_name !== symptom) continue;
        if (row.rule_code === target.mustRuleCode) continue;
        pushRow(row);
        if (out.filter(r => r.symptom_name === symptom).length >= 3) break;
      }
    }
  }

  return out;
}
