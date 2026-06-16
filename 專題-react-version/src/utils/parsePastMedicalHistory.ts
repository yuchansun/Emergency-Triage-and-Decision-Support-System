/** 解析 patients / vital_signs 的 past_medical_history 字串（格式：項目, 項目; 其他詳情） */
export function parsePastMedicalHistory(raw: string | null | undefined): {
  pastHistory: string[];
  otherHistoryDetails: string;
} {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { pastHistory: [], otherHistoryDetails: "" };
  }
  const [historyItemsPart, otherHistoryPart] = text.split(/\s*;\s*/);
  const pastHistory = historyItemsPart
    ? historyItemsPart.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    pastHistory,
    otherHistoryDetails: otherHistoryPart?.trim() ?? "",
  };
}

export function formatPastMedicalHistory(
  pastHistory: string[],
  otherHistoryDetails?: string
): string {
  return [pastHistory.join(", "), otherHistoryDetails?.trim()]
    .filter(Boolean)
    .join("; ");
}
