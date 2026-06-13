/**
 * 發表展示模式（方法 B）：僅在 VITE_PRESENTATION_MODE=true 且主訴關鍵字命中時，
 * 對兩個預設情境保底推薦症狀與判斷規則；其餘檢傷流程不受影響。
 */

export const PRESENTATION_MODE =
  import.meta.env.VITE_PRESENTATION_MODE === 'true' ||
  import.meta.env.VITE_PRESENTATION_MODE === '1';

export type PresentationScenarioId = 'cough_dyspnea' | 'flank_pain';

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

const normalizeMatchText = (text: string): string =>
  (text || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** 情境一：咳嗽、多痰、呼吸喘 + SpO2 偏低展示 */
const matchesCoughDyspnea = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  const hasCough = /咳嗽|咳痰|很多痰|痰多|有痰/.test(t);
  const hasDyspnea = /喘|呼吸.*急|呼吸越來越|呼吸困難|dyspnea|shortness of breath/i.test(t);
  return hasCough && hasDyspnea;
};

/** 情境二：外籍病患右側腰痛、解尿困難 */
const matchesFlankPain = (text: string): boolean => {
  const raw = text.trim();
  if (!raw) return false;
  const lower = normalizeMatchText(raw);
  const hasFlank =
    /right flank|flank.*hurt|flank pain|側腹|右腰|腰痛/.test(lower) ||
    /腰痛|右腰/.test(raw);
  const hasUrinary =
    /urinat|解尿|排尿|小便|strong urge/.test(lower) ||
    /解尿|排尿|頻尿|小便困難/.test(raw);
  return hasFlank && hasUrinary;
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
    id: 'flank_pain',
    match: matchesFlankPain,
    summary: '右腰痛、解尿困難',
    activeTab: 'a',
    mustSymptoms: ['腰痛'],
    decoySymptoms: [
      '泌尿道感染相關症狀（頻尿、解尿疼痛）',
      '腹痛',
      '鼠蹊部疼痛/腫塊',
    ],
    ruleTargets: [
      {
        symptomName: '腰痛',
        mustRuleCode: 'A060113',
        mustJudgeIncludes: '急性中樞中度疼痛',
        decoyRuleCodes: ['A060111', 'A060115'],
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
