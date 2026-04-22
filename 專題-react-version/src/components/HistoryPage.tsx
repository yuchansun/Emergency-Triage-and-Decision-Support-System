import React, { useEffect, useState } from "react";

type HistoryPageProps = {
  patientData?: any;
  initialKeyword?: string;
  initialSelectedTriageId?: string | null;
  onEditRecord?: (triageId: string) => void;
};

type TriageRecord = {
  triageId: string;
  patientId: string;
  name: string;
  gender: "M" | "F";
  birthday: string;
  age: number;
  idNumber: string;
  triageLevel: 1 | 2 | 3 | 4 | 5;
  chiefComplaintNote: string; // 護理師主訴敘述
  finalSymptoms: string[]; // 最後症狀
  arrivalAt: string; // YYYY-MM-DD HH:mm
  nurseId: string;
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

const levelColor = (level: number) =>
  ({
    1: "text-red-700 bg-red-50 border-red-200",
    2: "text-orange-700 bg-orange-50 border-orange-200",
    3: "text-yellow-700 bg-yellow-50 border-yellow-200",
    4: "text-green-700 bg-green-50 border-green-200",
    5: "text-blue-700 bg-blue-50 border-blue-200",
  }[level] || "text-gray-700 bg-gray-50 border-gray-200");

const HistoryPage: React.FC<HistoryPageProps> = ({ patientData: _patientData, initialKeyword, initialSelectedTriageId, onEditRecord }) => {
  const [form, setForm] = useState<FilterForm>(createDefaultFilter());
  const [applied, setApplied] = useState<FilterForm>(createDefaultFilter());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [records, setRecords] = useState<TriageRecord[]>([]);
  const [selected, setSelected] = useState<TriageRecord | null>(null);
  const [selectedRaw, setSelectedRaw] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dateInputResetKey, setDateInputResetKey] = useState(0);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

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
      setSelectedRaw(d);
      const mapped: TriageRecord = {
        triageId: d.triage_id || "",
        patientId: d.patient_id || "",
        name: d.name || "",
        gender: d.gender === "F" ? "F" : "M",
        birthday: d.birth_date ? String(d.birth_date).slice(0, 10) : "",
        age: d.age || 0,
        idNumber: d.id_number || "",
        triageLevel: (Number(d.triage_level) || 5) as 1 | 2 | 3 | 4 | 5,
        chiefComplaintNote: d.chief_complaint || "",
        finalSymptoms: String(d.tocc_symptoms || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        arrivalAt: d.visit_time ? String(d.visit_time) : String(d.created_at || ""),
        nurseId: d.nurse_id || "",
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
        } catch {}
        return v.split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };
    const isMale = (g: any) => g === "M" || g === "男";
    const isFemale = (g: any) => g === "F" || g === "女";
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
        <td class="c">${isMale(data?.gender) ? "☑" : "☐"} 男 M ${isFemale(data?.gender) ? "☑" : "☐"} 女 F</td>
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
            <br>備註：${safe(data?.notes)}
          </div>
        </td>
      </tr>

      <tr>
        <td class="small">檢傷人員</td>
        <td class="c">${safe(data?.nurse_id)}</td>
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

  const handleEdit = () => {
    if (!selected?.triageId) return;
    if (onEditRecord) {
      onEditRecord(selected.triageId);
      setSelected(null);
      return;
    }
    window.alert("目前無法切換到修改頁");
  };

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
                  <option value="1">第一級</option>
                  <option value="2">第二級</option>
                  <option value="3">第三級</option>
                  <option value="4">第四級</option>
                  <option value="5">第五級</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={resetFilters} className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-medium hover:bg-red-100">
              清除查詢
            </button>
            <button onClick={handleSearch} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 shadow-sm">
              查詢
            </button>
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
                    <td className="px-4 py-3 text-blue-600">{r.triageId}</td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{r.patientId}</td>
                    <td className="px-4 py-3">{r.gender === "M" ? "男" : "女"} / {r.age}</td>
                    <td className="px-4 py-3">{r.chiefComplaintNote}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${levelColor(r.triageLevel)}`}>
                        第 {r.triageLevel} 級
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

      {selected && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/25" onClick={() => setSelected(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold text-gray-800">檢傷紀錄詳情 {loadingDetail ? "（讀取中）" : ""}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={exportWord}
                className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100"
              >
                下載 Word
              </button>
              <button
                type="button"
                onClick={handleEdit}
                className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100"
              >
                修改
              </button>
            </div>

            <div className={`rounded-xl border px-4 py-3 mt-4 mb-4 ${levelColor(selected.triageLevel)}`}>
              <div className="text-xs">檢傷級數</div>
              <div className="text-xl font-bold">第 {selected.triageLevel} 級</div>
              <div className="mt-2 text-base font-semibold">姓名：{selected.name}</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-gray-500">檢傷號</div><div className="font-semibold">{selected.triageId}</div></div>
              <div><div className="text-gray-500">病歷號</div><div className="font-semibold">{selected.patientId}</div></div>
              <div><div className="text-gray-500">姓名</div><div className="font-semibold">{selected.name}</div></div>
              <div><div className="text-gray-500">身分證號</div><div className="font-semibold">{selected.idNumber}</div></div>
              <div><div className="text-gray-500">性別 / 年齡</div><div className="font-semibold">{selected.gender === "M" ? "男" : "女"} / {selected.age}</div></div>
              <div><div className="text-gray-500">生日</div><div className="font-semibold">{selected.birthday}</div></div>
              <div><div className="text-gray-500">到院時間</div><div className="font-semibold">{selected.arrivalAt}</div></div>
              <div><div className="text-gray-500">檢傷人員</div><div className="font-semibold">{selected.nurseId}</div></div>
            </div>

            <div className="mt-6">
              <div className="text-gray-500 text-sm">主訴（護理師敘述）</div>
              <div className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3">{selected.chiefComplaintNote}</div>
              <div className="text-gray-500 text-sm mt-3">最後症狀</div>
              <div className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3">
                {selected.finalSymptoms.join("、")}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-gray-500 text-sm mb-2">生命徵象</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">T: {selected.vitals.temperature} ℃</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">HR: {selected.vitals.heartRate} /min</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">RR: {selected.vitals.respRate} /min</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">SpO2: {selected.vitals.spo2}%</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">BP: {selected.vitals.bpSys}/{selected.vitals.bpDia}</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">BS: {selected.vitals.bloodSugar}</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">體重: {selected.vitals.weight} kg</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">GCS: E{selected.vitals.gcsE} / V{selected.vitals.gcsV} / M{selected.vitals.gcsM}</div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">疼痛: {selected.vitals.painScore}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-gray-500 text-sm mb-2">TOCC</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  旅遊史：{selected.tocc.travel}
                  {selected.tocc.travel === "有" ? `（${selected.tocc.travelStart} ~ ${selected.tocc.travelEnd}）` : ""}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  職業：{selected.tocc.occupation} {selected.tocc.occupationOther ? ` / ${selected.tocc.occupationOther}` : ""}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  接觸史：{selected.tocc.contactItems.length ? selected.tocc.contactItems.join("、") : "無"}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  群聚史：{selected.tocc.clusterItems.length ? selected.tocc.clusterItems.join("、") : "無"} {selected.tocc.clusterOther ? ` / ${selected.tocc.clusterOther}` : ""}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  症狀：{selected.tocc.symptoms.length ? selected.tocc.symptoms.join("、") : "無"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;