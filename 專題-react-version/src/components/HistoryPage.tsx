import React, { useEffect, useState } from "react";

type HistoryPageProps = {
  patientData?: any;
  initialKeyword?: string;
  initialSelectedTriageId?: string | null;
  onViewNurse?: (nurseId: string) => void;
  onGoToMain?: (record: any) => void;
};

type TriageRecord = {
  triageId: string;
  patientId: string;
  name: string;
  gender: "M" | "F" | "U";
  birthday: string;
  age: number;
  idNumber: string;
  triageLevel: 1 | 2 | 3 | 4 | 5 | null;
  chiefComplaintNote: string; // 護理師主訴敘述
  finalSymptoms: string[]; // 最後症狀
  arrivalAt: string; // YYYY-MM-DD HH:mm
  nurseId: string;
  nurseName?: string;
  vitals: {
    temperature: number;
    heartRate: number;
    respRate: number;
    spo2: number;
    bpSys: number;
    bpDia: number;
    bloodSugar: number;
    weight: number;
    gcsE: number;
    gcsV: number;
    gcsM: number;
    painScore: number;
    obHistory: string;
    pastHistory: string[];
    doNotTreat: string;
    allergyStatus: "無" | "不詳" | "有";
    allergyDetail: string;
    sentiment: number | null;
  };
  tocc: {
    travel: string;
    travelStart: string;
    travelEnd: string;
    occupation: string;
    occupationOther: string;
    contactItems: string[];
    clusterItems: string[];
    clusterOther: string;
    symptoms: string[];
  };
};

type ModificationLog = {
  log_id: number | string;
  staff_id: number | string;
  staff_name: string;
  staff_role: string;
  action_type: string;
  target_table: string;
  target_record_id: string;
  old_data: any;
  new_data: any;
  modified_at: string;
};

type ChangeLine = {
  path: string;
  oldValue: any;
  newValue: any;
};

type TriageHierarchyRow = {
  symptom_name: string;
  rule_code: string;
  judge_name: string;
  ttas_degree: number | null;
  nhi_degree?: number | null;
};

const ZERO_LIKE_VALUES = new Set([0, 0.0, 0.00, "0", "0.0", "0.00"]);

const CHANGE_LABELS: Record<string, string> = {
  triage_record: "檢傷資料",
  vital_signs: "生命徵象",
  encounter_extra: "就診補充",
  triage_result: "檢傷結果",
  patient_id: "病患編號",
  nurse_id: "護理師編號",
  final_level: "檢傷級數",
  created_at: "建立時間",
  temperature: "體溫",
  heart_rate: "心跳",
  spo2: "血氧",
  respiratory_rate: "呼吸速率",
  weight: "體重",
  blood_pressure_sys: "收縮壓",
  blood_pressure_dia: "舒張壓",
  blood_sugar: "血糖",
  gcs_eye: "GCS 眼睛反應",
  gcs_verbal: "GCS 語言反應",
  gcs_motor: "GCS 運動反應",
  past_medical_history: "既往病史",
  do_not_treat: "不治療",
  allergy: "過敏史",
  pain_score: "疼痛分數",
  sentiment: "情緒分數",
  bed: "床號",
  patient_source: "病患來源",
  major_incident: "重大事件",
  visit_time: "到院時間",
  tocc_travel: "旅遊史",
  tocc_travel_start: "旅遊開始",
  tocc_travel_end: "旅遊結束",
  tocc_cluster_items: "群聚項目",
  tocc_cluster_other: "群聚其他",
  tocc_symptoms: "症狀",
  tocc_occupation: "職業",
  tocc_occupation_other: "職業其他",
  rule_code: "規則代碼",
  chief_complaint: "主訴",
};

type FilterForm = {
  keyword: string;
  visitDate: string;
  gender: string;
  birthday: string;
  triageLevel: string;
};

const PAGE_SIZE = 20;

const createDefaultFilter = (): FilterForm => ({
  keyword: "",
  visitDate: "",
  gender: "",
  birthday: "",
  triageLevel: "",
});

const normalizeTriageLevel = (value: any): 1 | 2 | 3 | 4 | 5 | null => {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  return [1, 2, 3, 4, 5].includes(n) ? (n as 1 | 2 | 3 | 4 | 5) : null;
};

const isValidTriageLevel = (value: number | null | undefined): value is 1 | 2 | 3 | 4 | 5 =>
  [1, 2, 3, 4, 5].includes(Number(value));

const formatTriageLabel = (level: number | null | undefined) =>
  isValidTriageLevel(level) ? `第 ${level} 級` : "none";

const levelColor = (level: number | null | undefined) => {
  const colors: Record<number, string> = {
    1: "text-red-700 bg-red-50 border-red-200",
    2: "text-orange-700 bg-orange-50 border-orange-200",
    3: "text-yellow-700 bg-yellow-50 border-yellow-200",
    4: "text-green-700 bg-green-50 border-green-200",
    5: "text-blue-700 bg-blue-50 border-blue-200",
  };

  return colors[level ?? -1] || "text-gray-700 bg-gray-50 border-gray-200";
};

const HistoryPage: React.FC<HistoryPageProps> = ({ patientData: _patientData, initialKeyword, initialSelectedTriageId, onViewNurse, onGoToMain }) => {
  const [form, setForm] = useState<FilterForm>(createDefaultFilter());
  const [applied, setApplied] = useState<FilterForm>(createDefaultFilter());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [records, setRecords] = useState<TriageRecord[]>([]);
  const [selected, setSelected] = useState<TriageRecord | null>(null);
  const [selectedRaw, setSelectedRaw] = useState<any>(null);
  const [editDraft, setEditDraft] = useState<TriageRecord | null>(null);
  const [hierarchyRows, setHierarchyRows] = useState<TriageHierarchyRow[]>([]);
  const [ruleCodeSearch, setRuleCodeSearch] = useState("");
  const [ruleCodeLevelFilter, setRuleCodeLevelFilter] = useState<"" | "1" | "2" | "3" | "4" | "5">("");
  const [editRuleCode, setEditRuleCode] = useState("");
  const [editSelectedLevel, setEditSelectedLevel] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dateInputResetKey, setDateInputResetKey] = useState(0);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const isDemoRecord = (triageId: string) => triageId.startsWith("DEMO-");

  const deleteDemoRecord = async (triageId: string) => {
    if (!isDemoRecord(triageId)) {
      alert("僅可刪除教學示範資料。");
      return;
    }
    if (!window.confirm("確定刪除此教學紀錄？此紀錄將從資料庫移除。")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/triagesave/${encodeURIComponent(triageId)}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "刪除失敗");
      }
      setRecords((prev) => prev.filter((r) => r.triageId !== triageId));
      setTotal((prev) => Math.max(0, prev - 1));
      setSelected(null);
      alert("教學紀錄已刪除");
    } catch (err) {
      const message = err instanceof Error ? err.message : "刪除失敗";
      alert(message);
    } finally {
      setDeleting(false);
    }
  };

  const parseAllergyValue = (raw: any): { status: "無" | "不詳" | "有"; detail: string } => {
    const value = String(raw || "").trim();
    if (!value) return { status: "無", detail: "" };
    if (value.startsWith("有-")) return { status: "有", detail: value.slice(2).trim() };
    if (value === "有") return { status: "有", detail: "" };
    if (value === "不詳") return { status: "不詳", detail: "" };
    if (value === "無") return { status: "無", detail: "" };
    return { status: "有", detail: value };
  };

  const formatAllergyValue = (status: "無" | "不詳" | "有", detail: string): string => {
    if (status === "有") {
      const normalizedDetail = detail.trim();
      return normalizedDetail ? `有-${normalizedDetail}` : "有";
    }
    return status;
  };

  const flattenChanges = (oldValue: any, newValue: any, prefix = ""): ChangeLine[] => {
    if (oldValue === newValue) return [];

    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      const maxLength = Math.max(oldValue.length, newValue.length);
      const isObjectArray = [...oldValue, ...newValue].some((item) => item && typeof item === "object" && !Array.isArray(item));

      if (isObjectArray) {
        return Array.from({ length: maxLength }, (_, index) => {
          const childPrefix = `${prefix}[${index}]`;
          return flattenChanges(oldValue[index], newValue[index], childPrefix);
        }).flat();
      }

      return Array.from({ length: maxLength }, (_, index) => {
        const childPrefix = `${prefix}[${index}]`;
        return flattenChanges(oldValue[index], newValue[index], childPrefix);
      }).flat();
    }

    const oldIsObject = oldValue && typeof oldValue === "object" && !Array.isArray(oldValue);
    const newIsObject = newValue && typeof newValue === "object" && !Array.isArray(newValue);

    if (oldIsObject && newIsObject) {
      const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)])).sort();
      return keys.flatMap((key) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        return flattenChanges(oldValue[key], newValue[key], nextPrefix);
      });
    }

    return [{ path: prefix || "資料", oldValue, newValue }];
  };

  const formatChangePath = (path: string) => {
    if (!path) return "資料";
    return path
      .split(".")
      .map((segment) => {
        const match = segment.match(/^(.+?)\[(\d+)\]$/);
        if (match) {
          const key = CHANGE_LABELS[match[1]] || match[1];
          return `${key} 第${Number(match[2]) + 1}筆`;
        }
        return CHANGE_LABELS[segment] || segment;
      })
      .join("／");
  };

  const formatChangeValue = (value: any, path = ""): string => {
    if (value === null || value === undefined || value === "") return "無";
    if (Array.isArray(value)) {
      if (!value.length) return "無";
      return value.map((item, index) => formatChangeValue(item, `${path}[${index}]`)).join("；");
    }
    if (typeof value === "object") {
      const entries: string[] = Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined && item !== "")
        .map(([key, item]) => `${CHANGE_LABELS[key] || key}：${formatChangeValue(item, key)}`);
      return entries.length ? entries.join("、") : "無";
    }
    return String(value);
  };

  const isEmptyAuditValue = (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (value === "") return true;
    if (typeof value === "string") return value.trim() === "" || value.trim() === "無";
    return false;
  };

  const isZeroLikeValue = (value: any): boolean => {
    if (typeof value === "number") return value === 0;
    if (typeof value === "string") return ZERO_LIKE_VALUES.has(value.trim());
    return false;
  };

  const shouldHideAuditChange = (change: ChangeLine): boolean => {
    const oldDisplay = formatChangeValue(change.oldValue, change.path);
    const newDisplay = formatChangeValue(change.newValue, change.path);
    if (oldDisplay === newDisplay) return true;

    const oldEmpty = isEmptyAuditValue(change.oldValue);
    const newZeroLike = isZeroLikeValue(change.newValue) || isEmptyAuditValue(change.newValue);
    return oldEmpty && newZeroLike;
  };

  const getVisibleModificationLogs = () => {
    const logs = modificationLogs.filter((log) => log.action_type !== "INSERT");
    if (logs.length <= 1) return [];
    return logs.slice(0, -1);
  };

  const setField = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (initialKeyword !== undefined) {
      setForm((prev) => ({ ...prev, keyword: initialKeyword }));
      setApplied((prev) => ({ ...prev, keyword: initialKeyword }));
      setPage(1);
    }
  }, [initialKeyword]);

  useEffect(() => {
    if (!initialSelectedTriageId) return;
    void openDetail(initialSelectedTriageId);
  }, [initialSelectedTriageId]);

  useEffect(() => {
    let cancelled = false;

    const loadHierarchy = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/triage_hierarchy`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;

        const nextRows = data
          .map((row: any) => ({
            symptom_name: String(row?.symptom_name || "").trim(),
            rule_code: String(row?.rule_code || "").trim(),
            judge_name: String(row?.judge_name || "").trim(),
            ttas_degree: Number.isFinite(Number(row?.ttas_degree)) ? Number(row.ttas_degree) : null,
            nhi_degree: Number.isFinite(Number(row?.nhi_degree)) ? Number(row.nhi_degree) : null,
          }))
          .filter((row: TriageHierarchyRow) => row.symptom_name || row.rule_code || row.judge_name);

        if (!cancelled) {
          setHierarchyRows(nextRows);
        }
      } catch {
        // 忽略規則清單載入失敗，編輯仍可手動輸入編號
      }
    };

    void loadHierarchy();

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL]);

  const fetchRecords = async (targetPage: number, targetFilter: FilterForm) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        page_size: String(PAGE_SIZE),
      });
      if (targetFilter.keyword.trim()) params.set("keyword", targetFilter.keyword.trim());
      if (targetFilter.visitDate) {
        params.set("from_date", targetFilter.visitDate);
        params.set("to_date", targetFilter.visitDate);
      }
      if (targetFilter.gender) params.set("gender", targetFilter.gender);
      if (targetFilter.birthday) {
        params.set("birth_from", targetFilter.birthday);
        params.set("birth_to", targetFilter.birthday);
      }
      if (targetFilter.triageLevel) params.set("triage_level", targetFilter.triageLevel);

      const res = await fetch(`${API_BASE_URL}/history/records?${params.toString()}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "查詢失敗");
      }

      setRecords(result.data || []);
      setTotal(result.pagination?.total || 0);
      setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
    } catch (err) {
      const message = err instanceof Error ? err.message : "查詢失敗";
      setErrorMsg(message);
      setRecords([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (triageId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/triage-report/${encodeURIComponent(triageId)}`);
      const result = await res.json();
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.detail || "讀取詳情失敗");
      }
      const d = result.data;
      const allergyParsed = parseAllergyValue(d.allergy);
      const symptomRulePairs = Array.isArray(d.symptom_rule_pairs) ? d.symptom_rule_pairs : [];
      const formattedSymptoms = symptomRulePairs
        .map((item: any) => {
          const symptom = String(item?.symptom_name || "").trim();
          const judge = String(item?.judge_name || "").trim();
          return symptom && judge ? `${symptom}-${judge}` : "";
        })
        .filter(Boolean);
      setSelectedRaw(d);
      const mapped: TriageRecord = {
        triageId: d.triage_id || "",
        patientId: d.patient_id || "",
        name: d.name || "",
        gender: d.gender === "F" ? "F" : d.gender === "M" ? "M" : "U",
        birthday: d.birth_date ? String(d.birth_date).slice(0, 10) : "",
        age: d.age || 0,
        idNumber: d.id_number || "",
        triageLevel: normalizeTriageLevel(d.triage_level),
        chiefComplaintNote: d.chief_complaint || "",
        finalSymptoms:
          formattedSymptoms.length > 0
            ? formattedSymptoms
            : String(d.tocc_symptoms || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
        arrivalAt: d.visit_time ? String(d.visit_time) : String(d.created_at || ""),
        nurseId: d.nurse_id || "",
        nurseName: d.nurse_name || "",
        vitals: {
          temperature: Number(d.temperature || 0),
          heartRate: Number(d.heart_rate || 0),
          respRate: Number(d.respiratory_rate || 0),
          spo2: Number(d.spo2 || 0),
          bpSys: Number(d.blood_pressure_sys || 0),
          bpDia: Number(d.blood_pressure_dia || 0),
          bloodSugar: Number(d.blood_sugar || 0),
          weight: Number(d.weight || 0),
          gcsE: Number(d.gcs_eye || 0),
          gcsV: Number(d.gcs_verbal || 0),
          gcsM: Number(d.gcs_motor || 0),
          painScore: Number(d.pain_score || 0),
          obHistory: String(d.obs_history || ""),
          pastHistory: String(d.past_medical_history || "")
            .split(/[、,，;；]/)
            .map((v) => v.trim())
            .filter(Boolean),
          doNotTreat: String(d.do_not_treat || ""),
          allergyStatus: allergyParsed.status,
          allergyDetail: allergyParsed.detail,
          sentiment: d.sentiment === null || d.sentiment === undefined ? null : Number(d.sentiment),
        },
        tocc: {
          travel: d.tocc_travel || "",
          travelStart: d.tocc_travel_start ? String(d.tocc_travel_start).slice(0, 10) : "",
          travelEnd: d.tocc_travel_end ? String(d.tocc_travel_end).slice(0, 10) : "",
          occupation: d.tocc_occupation || "",
          occupationOther: d.tocc_occupation_other || "",
          contactItems: [],
          clusterItems: String(d.tocc_cluster_items || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          clusterOther: d.tocc_cluster_other || "",
          symptoms: String(d.tocc_symptoms || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        },
      };
      setSelected(mapped);
      setEditDraft(mapped);
      setEditRuleCode(String(d.rule_code || "").trim());
      setEditSelectedLevel(normalizeTriageLevel(d.triage_level));
      setRuleCodeSearch("");
      setRuleCodeLevelFilter("");
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "讀取詳情失敗";
      window.alert(message);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    void fetchRecords(page, applied);
  }, [page, applied]);

  const handleSearch = () => {
    setApplied({ ...form });
    setPage(1);
  };

  const resetFilters = () => {
    const cleared = createDefaultFilter();
    setForm(cleared);
    setApplied(cleared);
    setPage(1);
    setDateInputResetKey((k) => k + 1);
  };

  const exportWord = () => {
    if (!selected) return;
    const data = selectedRaw ?? {};
    const TRIAGE_COLOR = "#FFD700";
    const safe = (v: any) => (v === null || v === undefined ? "" : String(v));
    const parseList = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          const p = JSON.parse(v);
          if (Array.isArray(p)) return p;
        } catch { }
        return v.split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };
    const isMale = (g: any) => g === "M" || g === "男";
    const isFemale = (g: any) => g === "F" || g === "女";
    const isUnknown = (g: any) => g === "U" || g === "不詳";
    const LEVEL_COLORS: Record<number, string> = {
      1: "#EF4444",
      2: "#F97316",
      3: "#EAB308",
      4: "#22C55E",
      5: "#3B82F6",
    };
    const getLevelCellStyle = (level: any, n: number) => {
      const c = LEVEL_COLORS[n];
      const selectedLevel = Number(level) === n;
      if (selectedLevel) {
        const textColor = "#fff";
        return `background:${c};color:${textColor};font-weight:700;border-color:${c};`;
      }
      return `color:black;font-weight:700;border-color:${c};`;
    };
    const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { box-sizing: border-box; }
body {
  font-family: 'PMingLiU','Microsoft JhengHei', serif;
  color: #111;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page-wrapper {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  margin: 0 auto;
  background: #fff;
  padding: 0;
}
.inner {
  position: relative;
  z-index: 20;
  padding: 8mm 6mm 8mm 6mm;
}
.corner {
  position: absolute;
  width: 8mm;
  height: 32mm;
  background: ${TRIAGE_COLOR};
  z-index: 10;
}
.corner-tl { top: 0; left: 0; }
.corner-tr { top: 0; right: 0; }
.corner-bl { bottom: 0; left: 0; }
.corner-br { bottom: 0; right: 0; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
td, th {
  border: 1px solid #444;
  padding: 2px 4px;
  vertical-align: top;
  font-size: 13px;
  line-height: 1.25;
  word-break: break-word;
}
.no-b td, .no-b th { border: none !important; }
.c { text-align: center; }
.r { text-align: right; }
.en { font-size: 11px; color: #333; }
.t1 { font-size: 22px; letter-spacing: 1px; }
.t2 { font-size: 15px; font-weight: 600; }
.t3 { font-size: 22px; font-weight: 700; }
.small { font-size: 12px; }
.row-pain { height: 56px; }
.row-chief { height: 118px; }
`;

    const templateHtml = `
<div class="page-wrapper">
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <div class="inner">
    <table class="no-b" style="margin-bottom:4px;">
      <tr>
        <td style="width:21%; padding-right:4px;">
          <table>
            <tr class="c">
              <td style="height:22px; ${getLevelCellStyle(data?.triage_level, 1)}">Ⅰ</td>
              <td style="${getLevelCellStyle(data?.triage_level, 2)}">Ⅱ</td>
              <td style="${getLevelCellStyle(data?.triage_level, 3)}">Ⅲ</td>
              <td style="${getLevelCellStyle(data?.triage_level, 4)}">Ⅳ</td>
              <td style="${getLevelCellStyle(data?.triage_level, 5)}">Ⅴ</td>
            </tr>
            <tr>
              <td colspan="5" class="c">
                <div class="small">檢傷分級</div>
                <div class="en">Triage Level</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="width:54%;" class="c">
          <div class="t1">天主教輔仁大學附設醫院</div>
          <div class="t2">急診檢傷</div>
          <div class="t3">Nursing Assessment Record</div>
          <div style="margin-top:2px; font-size:11px;">到院時間 <span class="en">Arrival time：</span>${data?.visit_time ?? ""}</div>
        </td>
        <td style="width:25%; padding-left:4px;">
          <table>
            <tr><td class="small">${safe(data?.created_at)}</td></tr>
            <tr><td class="small">檢傷號：${safe(data?.triage_id)}</td></tr>
            <tr><td class="small">病歷號 Chart No：${safe(data?.medical_id)}</td></tr>
            <tr><td class="small">科別 Department：${safe(data?.department ?? "PED")}</td></tr>
            <tr><td class="small">床號：${safe(data?.bed)}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table>
      <colgroup>
        <col style="width:16%">
        <col style="width:18%">
        <col style="width:11%">
        <col style="width:14%">
        <col style="width:8%">
        <col style="width:13%">
        <col style="width:20%">
      </colgroup>

      <tr>
        <td>姓名<br><span class="en">Name</span></td>
        <td>${safe(data?.name)}</td>
        <td>性別<br><span class="en">Gender</span></td>
        <td class="c">${isMale(data?.gender) ? "☑" : "☐"} 男 M ${isFemale(data?.gender) ? "☑" : "☐"} 女 F ${isUnknown(data?.gender) ? "☑" : "☐"} 不詳 U</td>
        <td class="c">${safe(data?.age ?? "無年齡資料")}<br>歲</td>
        <td>出生日期<br><span class="en">Birthday</span></td>
        <td class="c">${safe(data?.birth_date)}</td>
      </tr>

      <tr>
        <td>到院方式<br><span class="en">Mode of arrival</span></td>
        <td colspan="6">
          ${safe(data?.patient_source).includes("自行") ? "☑" : "☐"} 自行進入 &nbsp;&nbsp;
          ${safe(data?.patient_source).includes("門診") ? "☑" : "☐"} 門診轉入 &nbsp;&nbsp;
          ${safe(data?.patient_source).includes("119") ? "☑" : "☐"} 119 送入<br>
          ${safe(data?.patient_source).includes("他院") ? "☑" : "☐"} 他院轉入，轉自：
          <span style="display:inline-block;width:200px;border-bottom:1px solid #000;">${safe(data?.transfer_from)}</span><br>
          ${!["自行", "門診", "119", "他院"].some((k) => safe(data?.patient_source).includes(k)) ? "☑" : "☐"} 其他：
          <span style="display:inline-block;width:260px;border-bottom:1px solid #000;">${safe(data?.patient_source)}</span>
        </td>
      </tr>

      <tr>
        <td>產科史<br><span class="en">Obs-Gyn History</span></td>
        <td colspan="6">${safe(data?.obs_history)}</td>
      </tr>

      <tr>
        <td>過去病史<br><span class="en">Past History</span></td>
        <td colspan="6">
          ${safe(data?.past_medical_history)}
          <br>禁治療：${safe(data?.do_not_treat)}
        </td>
      </tr>

      <tr>
        <td>藥物過敏史<br><span class="en">Allergy History</span></td>
        <td colspan="6">${safe(data?.allergy)}</td>
      </tr>

      <tr>
        <td>意識狀態<br><span class="en">Consciousness</span></td>
        <td colspan="6">
          Glasgow Coma Scale：E <u>${safe(data?.gcs_eye)}</u> &nbsp; V <u>${safe(data?.gcs_verbal)}</u> &nbsp; M <u>${safe(data?.gcs_motor)}</u>
        </td>
      </tr>

      <tr>
        <td>生命徵象<br><span class="en">Vital Sign</span></td>
        <td colspan="6">
          T：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">${safe(data?.temperature)}</span> ℃，&nbsp;
          P：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">${safe(data?.heart_rate)}</span> 次/min，&nbsp;
          R：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">${safe(data?.respiratory_rate)}</span> 次/min<br>
          BP：<span style="display:inline-block;width:70px;border-bottom:1px solid #000;text-align:center;">${safe(data?.blood_pressure_sys)}/${safe(data?.blood_pressure_dia)}</span> mmHg，&nbsp;
          SpO2：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">${safe(data?.spo2)}</span> %，&nbsp;
          BS：<span style="display:inline-block;width:50px;border-bottom:1px solid #000;">${safe(data?.blood_sugar)}</span>
        </td>
      </tr>

      <tr>
        <td>發燒防疫篩檢<br>TOCC</td>
        <td colspan="6">
          旅遊史：<u>${safe(data?.tocc_travel)}</u> ${safe(data?.tocc_travel_start)} ${safe(data?.tocc_travel_end)}<br>
          職業：<u>${safe(data?.tocc_occupation)} ${safe(data?.tocc_occupation_other)}</u><br>
          群聚史：<u>${parseList(data?.tocc_cluster_items).join("、")} ${safe(data?.tocc_cluster_other)}</u><br>
          症狀：<u>${parseList(data?.tocc_symptoms).join("、")}</u>
        </td>
      </tr>

      <tr>
        <td>疼痛狀態<br><span class="en">Pain Status</span></td>
        <td colspan="5" class="row-pain">疼痛程度：${safe(data?.pain_score)}</td>
        <td>體重：<br>${safe(data?.weight)} kg</td>
      </tr>

      <tr>
        <td colspan="7" style="height:120px; vertical-align:top; padding:6px;">
          <div>
            病人主訴：${safe(data?.chief_complaint)}
            <br>判斷規則：${safe(data?.rule_code)}
          </div>
        </td>
      </tr>

      <tr>
        <td class="small">檢傷人員</td>
        <td class="c">${safe(data?.nurse_name ?? data?.nurse_id)}</td>
        <td colspan="5"></td>
      </tr>
    </table>

    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:4px; color:#555;">
      <div>MR-ER005 [版本：第 2 版]</div>
      <div>Page 1 of 1</div>
      <div>輔大醫院病歷管理委員會 2021.11.12 審定</div>
    </div>
  </div>
</div>
`;

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>急診檢傷</title>
        <style>${PRINT_CSS}</style>
      </head>
      <body>${templateHtml}</body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `急診檢傷報告-${selected.triageId || "record"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setDraftField = <K extends keyof TriageRecord>(key: K, value: TriageRecord[K]) => {
    setEditDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setDraftVital = (key: keyof TriageRecord["vitals"], value: number | string | string[] | null) => {
    setEditDraft((prev) =>
      prev
        ? {
          ...prev,
          vitals: {
            ...prev.vitals,
            [key]: value as never,
          },
        }
        : prev
    );
  };

  const setDraftTocc = (key: keyof TriageRecord["tocc"], value: string | string[]) => {
    setEditDraft((prev) =>
      prev
        ? {
          ...prev,
          tocc: {
            ...prev.tocc,
            [key]: value as never,
          },
        }
        : prev
    );
  };

  const handleStartEdit = () => {
    if (!selected) return;
    setEditDraft({ ...selected });
    setEditRuleCode(String(selectedRaw?.rule_code || "").trim());
    setEditSelectedLevel(selected.triageLevel ?? normalizeTriageLevel(selectedRaw?.triage_level));
    setRuleCodeSearch("");
    setRuleCodeLevelFilter("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditDraft(selected ? { ...selected } : null);
    setEditRuleCode(String(selectedRaw?.rule_code || "").trim());
    setEditSelectedLevel(selected?.triageLevel ?? normalizeTriageLevel(selectedRaw?.triage_level));
    setRuleCodeSearch("");
    setRuleCodeLevelFilter("");
    setIsEditing(false);
  };

  const applyRuleCodeSuggestion = (row: TriageHierarchyRow) => {
    setEditRuleCode(row.rule_code);
    const degree = normalizeTriageLevel(row.ttas_degree);
    if (degree !== null) {
      setEditSelectedLevel(degree);
    }
  };

  const normalizedRuleCodeSearch = ruleCodeSearch.trim().toLowerCase();
  const ruleCodeSuggestions = hierarchyRows
    .filter((row) => {
      if (ruleCodeLevelFilter && String(row.ttas_degree ?? "") !== ruleCodeLevelFilter) {
        return false;
      }

      const query = normalizedRuleCodeSearch || editDraft?.finalSymptoms.join(" ").trim().toLowerCase() || "";
      if (!query) return !!ruleCodeLevelFilter;

      return [row.symptom_name, row.rule_code, row.judge_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .slice(0, 12);

  const handleSaveEdit = async () => {
    if (!selected || !editDraft) return;
    setSaving(true);
    try {
      const payload = {
        triage_id: selected.triageId,
        triageId: selected.triageId,
        patientId: selected.patientId,
        patient_id: selected.patientId,
        name: editDraft.name,
        id_number: editDraft.idNumber,
        gender: editDraft.gender,
        age: editDraft.age,
        birth_date: editDraft.birthday?.trim() || null,
        nurseId: editDraft.nurseId || selected.nurseId || selectedRaw?.nurse_id || null,
        nurse_id: editDraft.nurseId || selected.nurseId || selectedRaw?.nurse_id || null,
        bed: selectedRaw?.bed ?? "",
        patientSource: selectedRaw?.patient_source ?? "",
        majorIncident: selectedRaw?.major_incident ?? "",
        visitTime: selectedRaw?.visit_time ?? selected.arrivalAt,
        tocc_travel: editDraft.tocc.travel,
        tocc_travel_start: editDraft.tocc.travelStart || null,
        tocc_travel_end: editDraft.tocc.travelEnd || null,
        tocc_occupation: editDraft.tocc.occupation || "",
        tocc_occupation_other: editDraft.tocc.occupationOther || "",
        tocc_cluster_items: editDraft.tocc.clusterItems.join(", "),
        tocc_cluster_other: editDraft.tocc.clusterOther || "",
        tocc_symptoms: editDraft.tocc.symptoms.join(", "),
        selectedLevel: editSelectedLevel ?? selected.triageLevel ?? normalizeTriageLevel(selectedRaw?.triage_level),
        result: {
          rule_code: editRuleCode.trim() || selectedRaw?.rule_code || "",
          chief_complaint: editDraft.chiefComplaintNote || "",
          original_transcript: selectedRaw?.original_transcript || "",
        },
        vitals: {
          temperature: Number(editDraft.vitals.temperature || 0),
          heart_rate: Number(editDraft.vitals.heartRate || 0),
          spo2: Number(editDraft.vitals.spo2 || 0),
          respiratory_rate: Number(editDraft.vitals.respRate || 0),
          weight: Number(editDraft.vitals.weight || 0),
          blood_pressure_sys: Number(editDraft.vitals.bpSys || 0),
          blood_pressure_dia: Number(editDraft.vitals.bpDia || 0),
          blood_sugar: Number(editDraft.vitals.bloodSugar || 0),
          gcs_eye: Number(editDraft.vitals.gcsE || 0),
          gcs_verbal: Number(editDraft.vitals.gcsV || 0),
          gcs_motor: Number(editDraft.vitals.gcsM || 0),
          past_medical_history: editDraft.vitals.pastHistory.join(", "),
          do_not_treat: editDraft.vitals.doNotTreat || "",
          allergy: formatAllergyValue(editDraft.vitals.allergyStatus, editDraft.vitals.allergyDetail),
          pain_score: Number(editDraft.vitals.painScore || 0),
          sentiment: editDraft.vitals.sentiment,
        },
      };

      const res = await fetch(`${API_BASE_URL}/triagesave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "儲存失敗");
      }

      await openDetail(selected.triageId);
      await fetchRecords(page, applied);
      setIsEditing(false);
      window.alert("修改已儲存");
    } catch (err) {
      const message = err instanceof Error ? err.message : "儲存失敗";
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const modificationLogs: ModificationLog[] = Array.isArray(selectedRaw?.modification_logs)
    ? selectedRaw.modification_logs
    : [];

  return (
    <div className="p-6 md:p-8 min-h-full bg-[#F8FAFC]">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">過去病史查詢</h1>
          <p className="text-gray-500 mt-1">先設定條件，再按查詢顯示結果（每頁 20 筆）</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
            <div className="xl:col-span-4">
              <label className="text-xs text-gray-600">文字查詢</label>
              <input
                value={form.keyword}
                onChange={(e) => setField("keyword", e.target.value)}
                placeholder="姓名 / 病歷號 / 就診號 / 主訴 / 症狀"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>

            <div className="xl:col-span-6 md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">到院日期</label>
                <input key={`visitDate-${dateInputResetKey}`} type="date" value={form.visitDate} onChange={(e) => setField("visitDate", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">性別</label>
                <select value={form.gender} onChange={(e) => setField("gender", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white">
                  <option value="">全部</option>
                  <option value="M">男</option>
                  <option value="F">女</option>
                </select>
              </div>
            </div>

          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="xl:col-span-2 md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">生日</label>
                <input key={`birthday-${dateInputResetKey}`} type="date" value={form.birthday} onChange={(e) => setField("birthday", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">檢傷級數</label>
                <select value={form.triageLevel} onChange={(e) => setField("triageLevel", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white">
                  <option value="">全部</option>
                  <option value="1" >第一級</option>
                  <option value="2">第二級</option>
                  <option value="3">第三級</option>
                  <option value="4">第四級</option>
                  <option value="5">第五級</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            {/* 左邊 */}
            <button
              onClick={() => {
                setForm((prev) => ({ ...prev, keyword: "直入急救室" }));
                setField("keyword", "直入急救室");
                handleSearch();
              }}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 shadow-sm"
            >
              直入急救室
            </button>

            {/* 右邊 */}
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-medium hover:bg-red-100"
              >
                清除查詢
              </button>

              <button
                onClick={handleSearch}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 shadow-sm"
              >
                查詢
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">最新檢傷紀錄</h2>
            <span className="text-sm text-gray-500">{`共 ${total} 筆`}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">到院時間</th>
                  <th className="text-left px-4 py-3">檢傷號</th>
                  <th className="text-left px-4 py-3">姓名</th>
                  <th className="text-left px-4 py-3">病歷號</th>
                  <th className="text-left px-4 py-3">性別/年齡</th>
                  <th className="text-left px-4 py-3">主訴摘要</th>
                  <th className="text-left px-4 py-3">級數</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.triageId} onClick={() => void openDetail(r.triageId)} className="border-t border-gray-100 hover:bg-blue-50/60 cursor-pointer">
                    <td className="px-4 py-3">{r.arrivalAt}</td>
                    <td className="px-4 py-3 text-blue-600">
                      {r.triageId}
                      {isDemoRecord(r.triageId) && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                          教學
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{r.patientId}</td>
                    <td className="px-4 py-3">{r.gender === "M" ? "男" : r.gender === "F" ? "女" : "不詳"} / {r.age}</td>
                    <td className="px-4 py-3">{r.chiefComplaintNote}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${levelColor(r.triageLevel)}`}>
                        {formatTriageLabel(r.triageLevel)}
                      </span>
                    </td>
                  </tr>
                ))}

                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      {errorMsg || "查無符合條件資料"}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      查詢中...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">第 {page} / {totalPages} 頁（每頁 {PAGE_SIZE} 筆）</div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
              >
                上一頁
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
              >
                下一頁
              </button>
            </div>
          </div>
        </div>
      </div>

      {selected && editDraft && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/25" onClick={() => setSelected(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-800">檢傷紀錄詳情 {loadingDetail ? "（讀取中）" : ""}</h3>
                {selected && isDemoRecord(selected.triageId) && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                    教學資料
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={exportWord}
                disabled={isEditing || saving}
                className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100"
              >
                下載 Word
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100"
                >
                  修改
                </button>
              )}
              {!isEditing && onGoToMain && (
                <button
                  type="button"
                  onClick={() => selectedRaw && onGoToMain?.(selectedRaw)}
                  className="px-4 py-2 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-700 text-sm font-medium hover:bg-yellow-100"
                >
                  返回主頁編輯
                </button>
              )}
              {selected && isDemoRecord(selected.triageId) && (
                <button
                  type="button"
                  onClick={() => void deleteDemoRecord(selected.triageId)}
                  disabled={deleting || saving}
                  className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100"
                >
                  {deleting ? "刪除中..." : "刪除教學資料"}
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl border border-emerald-600 bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? "儲存中..." : "儲存"}
                  </button>
                </>
              )}
            </div>

            <div className={`rounded-xl border px-4 py-3 mt-4 mb-4 ${levelColor(editDraft.triageLevel)}`}>
              <div className="text-xs">檢傷級數</div>
              <div className="text-xl font-bold">
                {formatTriageLabel(editDraft.triageLevel)}
              </div>
              <div className="mt-2 text-base font-semibold">姓名：{editDraft.name}</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-gray-500">檢傷號</div><div className="font-semibold">{selected.triageId}</div></div>
              <div><div className="text-gray-500">病歷號</div><div className="font-semibold">{selected.patientId}</div></div>
              <div>
                <div className="text-gray-500">姓名</div>
                {isEditing ? (
                  <input value={editDraft.name} onChange={(e) => setDraftField("name", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                ) : (
                  <div className="font-semibold">{selected.name}</div>
                )}
              </div>

              <div>
                <div className="text-gray-500">身分證號</div>
                {isEditing ? (
                  <input value={editDraft.idNumber} onChange={(e) => setDraftField("idNumber", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                ) : (
                  <div className="font-semibold">{selected.idNumber}</div>
                )}
              </div>

              <div>
                <div className="text-gray-500">性別 / 年齡</div>
                {isEditing ? (
                  <div className="mt-1 flex gap-2">
                    <select value={editDraft.gender} onChange={(e) => setDraftField("gender", e.target.value as "M" | "F" | "U")}
                      className="rounded border border-gray-300 px-2 py-1 text-sm bg-white">
                      <option value="M">男</option>
                      <option value="F">女</option>
                      <option value="U">不詳</option>
                    </select>
                    <input type="number" value={editDraft.age} onChange={(e) => setDraftField("age", Number(e.target.value))}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" />
                  </div>
                ) : (
                  <div className="font-semibold">{selected.gender === "M" ? "男" : selected.gender === "F" ? "女" : "不詳"} / {selected.age}</div>
                )}
              </div>

              <div>
                <div className="text-gray-500">生日</div>
                {isEditing ? (
                  <input type="date" value={editDraft.birthday} onChange={(e) => setDraftField("birthday", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                ) : (
                  <div className="font-semibold">{selected.birthday}</div>
                )}
              </div>
              <div><div className="text-gray-500">到院時間</div><div className="font-semibold">{editDraft.arrivalAt}</div></div>
              <div>
                <div className="text-gray-500">檢傷人員</div>
                {isEditing ? (
                  <div className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm text-gray-700">
                    {editDraft.nurseName || editDraft.nurseId}
                  </div>
                ) : (
                  <div
                    className={`font-semibold ${editDraft.nurseId ? 'text-blue-600 cursor-pointer hover:underline' : ''}`}
                    onClick={() => editDraft.nurseId && onViewNurse?.(editDraft.nurseId)}
                    title={editDraft.nurseId ? '前往護理師資料管理' : undefined}
                  >
                    {editDraft.nurseName || editDraft.nurseId || '無'}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-gray-500 text-sm">主訴</div>
              {isEditing ? (
                <textarea
                  value={editDraft.chiefComplaintNote}
                  onChange={(e) => setDraftField("chiefComplaintNote", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white border border-gray-300 p-3 min-h-20"
                />
              ) : (
                <div className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3">{editDraft.chiefComplaintNote}</div>
              )}
              <div className="text-gray-500 text-sm mt-3">最後症狀</div>
              {isEditing ? (
                <div className="mt-1 space-y-3">
                  <input
                    value={editDraft.finalSymptoms.join(", ")}
                    onChange={(e) =>
                      setDraftField(
                        "finalSymptoms",
                        e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean)
                      )
                    }
                    className="w-full rounded-xl bg-white border border-gray-300 p-3"
                    placeholder="可輸入多個最後症狀，以逗號分隔"
                  />
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="text-gray-500 text-sm">檢傷規格編號</div>
                    <input
                      value={editRuleCode}
                      onChange={(e) => {
                        const nextRuleCode = e.target.value;
                        setEditRuleCode(nextRuleCode);
                        const matchedRow = hierarchyRows.find((row) => row.rule_code === nextRuleCode.trim());
                        if (matchedRow?.ttas_degree !== null && matchedRow?.ttas_degree !== undefined) {
                          const normalizedLevel = normalizeTriageLevel(matchedRow.ttas_degree);
                          if (normalizedLevel !== null) {
                            setEditSelectedLevel(normalizedLevel);
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      placeholder="輸入或搜尋規格編號，例如 T030313"
                    />
                    <input
                      value={ruleCodeSearch}
                      onChange={(e) => setRuleCodeSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      placeholder="可輸入症狀名稱、判斷規則或編號來搜尋"
                    />
                    <select
                      value={ruleCodeLevelFilter}
                      onChange={(e) => setRuleCodeLevelFilter(e.target.value as "" | "1" | "2" | "3" | "4" | "5")}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">全部級數</option>
                      <option value="1">第一級</option>
                      <option value="2">第二級</option>
                      <option value="3">第三級</option>
                      <option value="4">第四級</option>
                      <option value="5">第五級</option>
                    </select>
                    <div className="text-xs text-gray-500">
                      搜尋結果點一下就會帶入規格編號與級數。
                      {ruleCodeLevelFilter ? ` 目前只顯示第 ${ruleCodeLevelFilter} 級。` : ""}
                    </div>
                    {ruleCodeSuggestions.length > 0 ? (
                      <div className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white">
                        {ruleCodeSuggestions.map((row) => (
                          <button
                            key={`${row.rule_code}-${row.symptom_name}`}
                            type="button"
                            onClick={() => applyRuleCodeSuggestion(row)}
                            className="flex w-full items-start justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-blue-50 last:border-b-0"
                          >
                            <span className="text-gray-700">
                              {row.symptom_name || "未命名症狀"} / {row.judge_name || "未命名規則"}
                            </span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold ${levelColor(row.ttas_degree)}`}>
                              {row.rule_code || "無編號"}{row.ttas_degree !== null && row.ttas_degree !== undefined ? ` ・ 第${row.ttas_degree}級` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (ruleCodeSearch.trim() || ruleCodeLevelFilter) ? (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-400">
                        查無符合條件的規格編號
                        {ruleCodeLevelFilter ? `（第 ${ruleCodeLevelFilter} 級）` : ""}
                      </div>
                    ) : null}
                    <div className="text-xs text-gray-500">
                      目前級數：{editSelectedLevel !== null && editSelectedLevel !== undefined ? `第 ${editSelectedLevel} 級` : "無"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    {editDraft.finalSymptoms.join("、")}
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
                    檢傷規格編號：{String(selectedRaw?.rule_code || "無")}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="text-gray-500 text-sm mb-2">生命徵象</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  T: {isEditing ? <input type="number" value={editDraft.vitals.temperature} onChange={(e) => setDraftVital("temperature", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.temperature} ℃
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  HR: {isEditing ? <input type="number" value={editDraft.vitals.heartRate} onChange={(e) => setDraftVital("heartRate", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.heartRate} /min
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  RR: {isEditing ? <input type="number" value={editDraft.vitals.respRate} onChange={(e) => setDraftVital("respRate", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.respRate} /min
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  體重: {isEditing ? <input type="number" value={editDraft.vitals.weight} onChange={(e) => setDraftVital("weight", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.weight} kg
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  SpO2: {isEditing ? <input type="number" value={editDraft.vitals.spo2} onChange={(e) => setDraftVital("spo2", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.spo2}%
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  BP:
                  {isEditing ? (
                    <>
                      <input type="number" value={editDraft.vitals.bpSys} onChange={(e) => setDraftVital("bpSys", Number(e.target.value))} className="w-14 rounded border border-gray-300 px-1 ml-1" />
                      /
                      <input type="number" value={editDraft.vitals.bpDia} onChange={(e) => setDraftVital("bpDia", Number(e.target.value))} className="w-14 rounded border border-gray-300 px-1 ml-1" />
                    </>
                  ) : (
                    `${editDraft.vitals.bpSys}/${editDraft.vitals.bpDia}`
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  BS: {isEditing ? <input type="number" value={editDraft.vitals.bloodSugar} onChange={(e) => setDraftVital("bloodSugar", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.bloodSugar}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  GCS:
                  {isEditing ? (
                    <>
                      E<input type="number" value={editDraft.vitals.gcsE} onChange={(e) => setDraftVital("gcsE", Number(e.target.value))} className="w-10 rounded border border-gray-300 px-1 ml-1 mr-1" />
                      / V<input type="number" value={editDraft.vitals.gcsV} onChange={(e) => setDraftVital("gcsV", Number(e.target.value))} className="w-10 rounded border border-gray-300 px-1 ml-1 mr-1" />
                      / M<input type="number" value={editDraft.vitals.gcsM} onChange={(e) => setDraftVital("gcsM", Number(e.target.value))} className="w-10 rounded border border-gray-300 px-1 ml-1" />
                    </>
                  ) : (
                    `E${editDraft.vitals.gcsE} / V${editDraft.vitals.gcsV} / M${editDraft.vitals.gcsM}`
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  疼痛: {isEditing ? <input type="number" value={editDraft.vitals.painScore} onChange={(e) => setDraftVital("painScore", Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 ml-1" /> : editDraft.vitals.painScore}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 col-span-3">
                  過去病史：
                  {isEditing ? (
                    <input
                      value={editDraft.vitals.pastHistory.join(", ")}
                      onChange={(e) =>
                        setDraftVital(
                          "pastHistory",
                          e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean)
                        )
                      }
                      className="ml-1 w-full rounded border border-gray-300 px-2 py-1 mt-1"
                    />
                  ) : (
                    editDraft.vitals.pastHistory.length ? editDraft.vitals.pastHistory.join("、") : "無"
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 col-span-3">
                  禁治療：
                  {isEditing ? (
                    <input
                      value={editDraft.vitals.doNotTreat}
                      onChange={(e) => setDraftVital("doNotTreat", e.target.value)}
                      className="ml-1 w-full rounded border border-gray-300 px-2 py-1 mt-1"
                    />
                  ) : (
                    editDraft.vitals.doNotTreat || "無"
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 col-span-3">
                  藥物過敏：
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-2">
                      <select
                        value={editDraft.vitals.allergyStatus}
                        onChange={(e) => setDraftVital("allergyStatus", e.target.value as "無" | "不詳" | "有")}
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        <option value="無">無</option>
                        <option value="不詳">不詳</option>
                        <option value="有">有</option>
                      </select>
                      {editDraft.vitals.allergyStatus === "有" && (
                        <input
                          value={editDraft.vitals.allergyDetail}
                          onChange={(e) => setDraftVital("allergyDetail", e.target.value)}
                          placeholder="藥物過敏詳情"
                          className="flex-1 rounded border border-gray-300 px-2 py-1"
                        />
                      )}
                    </div>
                  ) : (
                    formatAllergyValue(editDraft.vitals.allergyStatus, editDraft.vitals.allergyDetail)
                  )}
                </div>
                {editDraft.gender === "F" && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 col-span-3">
                    產科史：
                    {isEditing ? (
                      <input
                        value={editDraft.vitals.obHistory}
                        onChange={(e) => setDraftVital("obHistory", e.target.value)}
                        className="ml-1 w-full rounded border border-gray-300 px-2 py-1 mt-1"
                      />
                    ) : (
                      editDraft.vitals.obHistory || "無"
                    )}
                  </div>
                )}
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 col-span-3">
                  心理/情緒狀態：
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={editDraft.vitals.sentiment ?? ""}
                      onChange={(e) => setDraftVital("sentiment", e.target.value === "" ? null : Number(e.target.value))}
                      className="ml-1 w-20 rounded border border-gray-300 px-2 py-1"
                    />
                  ) : (
                    editDraft.vitals.sentiment ?? "無"
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-gray-500 text-sm mb-2">TOCC</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  旅遊史：
                  {isEditing ? (
                    <>
                      <input value={editDraft.tocc.travel} onChange={(e) => setDraftTocc("travel", e.target.value)} className="ml-1 w-20 rounded border border-gray-300 px-1" />
                      <input type="date" value={editDraft.tocc.travelStart} onChange={(e) => setDraftTocc("travelStart", e.target.value)} className="ml-2 rounded border border-gray-300 px-1" />
                      <span className="mx-1">~</span>
                      <input type="date" value={editDraft.tocc.travelEnd} onChange={(e) => setDraftTocc("travelEnd", e.target.value)} className="rounded border border-gray-300 px-1" />
                    </>
                  ) : (
                    <>
                      {editDraft.tocc.travel}
                      {editDraft.tocc.travel === "有" ? `（${editDraft.tocc.travelStart} ~ ${editDraft.tocc.travelEnd}）` : ""}
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  職業：
                  {isEditing ? (
                    <>
                      <input value={editDraft.tocc.occupation} onChange={(e) => setDraftTocc("occupation", e.target.value)} className="ml-1 w-28 rounded border border-gray-300 px-1" />
                      <input value={editDraft.tocc.occupationOther} onChange={(e) => setDraftTocc("occupationOther", e.target.value)} className="ml-2 w-40 rounded border border-gray-300 px-1" placeholder="其他" />
                    </>
                  ) : (
                    `${editDraft.tocc.occupation} ${editDraft.tocc.occupationOther ? ` / ${editDraft.tocc.occupationOther}` : ""}`
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  接觸史：{editDraft.tocc.contactItems.length ? editDraft.tocc.contactItems.join("、") : "無"}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  群聚史：
                  {isEditing ? (
                    <>
                      <input
                        value={editDraft.tocc.clusterItems.join(", ")}
                        onChange={(e) =>
                          setDraftTocc(
                            "clusterItems",
                            e.target.value
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean)
                          )
                        }
                        className="ml-1 w-56 rounded border border-gray-300 px-1"
                      />
                      <input value={editDraft.tocc.clusterOther} onChange={(e) => setDraftTocc("clusterOther", e.target.value)} className="ml-2 w-40 rounded border border-gray-300 px-1" placeholder="其他" />
                    </>
                  ) : (
                    `${editDraft.tocc.clusterItems.length ? editDraft.tocc.clusterItems.join("、") : "無"} ${editDraft.tocc.clusterOther ? ` / ${editDraft.tocc.clusterOther}` : ""}`
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  症狀：
                  {isEditing ? (
                    <input
                      value={editDraft.tocc.symptoms.join(", ")}
                      onChange={(e) =>
                        setDraftTocc(
                          "symptoms",
                          e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean)
                        )
                      }
                      className="ml-1 w-72 rounded border border-gray-300 px-1"
                    />
                  ) : (
                    editDraft.tocc.symptoms.length ? editDraft.tocc.symptoms.join("、") : "無"
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-gray-500 text-sm">修改歷史</div>
                <div className="text-xs text-gray-400">只顯示歷史頁儲存後產生的異動紀錄</div>
              </div>

              {getVisibleModificationLogs().length > 0 ? (
                <div className="space-y-3">
                  {getVisibleModificationLogs()
                    .map((log) => (
                    <details key={log.log_id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <summary className="cursor-pointer list-none flex flex-wrap items-center gap-2 text-sm text-gray-700">
                        <span className="font-semibold text-gray-800">修改</span>
                        <span className="text-gray-500">{log.staff_name ? `${log.staff_name}` : `人員 ${log.staff_id}`}</span>
                        <span className="text-gray-400">{log.modified_at ? String(log.modified_at).replace("T", " ") : ""}</span>
                      </summary>

                      <div className="mt-3 space-y-2 text-xs text-gray-700">
                        {flattenChanges(log.old_data, log.new_data)
                          .filter((change) => !shouldHideAuditChange(change))
                          .map((change, index) => {
                          return (
                            <div key={`${log.log_id}-${index}`} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                              <span className="font-semibold text-gray-800">{formatChangePath(change.path)}</span>
                              <span className="ml-2">由 {formatChangeValue(change.oldValue, change.path)} 變更為 {formatChangeValue(change.newValue, change.path)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
                  目前沒有修改紀錄
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;