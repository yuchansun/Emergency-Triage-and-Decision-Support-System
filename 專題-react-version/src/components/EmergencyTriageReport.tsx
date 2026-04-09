import React, { useState, useRef, useEffect } from "react";
import { Editor } from "@tinymce/tinymce-react";

type Props = {
  patientData?: any;
  onBack: () => void;
};

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
    return v.split(/[、,，;；]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const isMale = (g: any) => g === "M" || g === "男";
const isFemale = (g: any) => g === "F" || g === "女";

const getPrintCSS = (color: string) => `
@page { size: A4 portrait; margin: 0; }   /* 改 0，色塊才會貼頁邊 */
html, body { margin: 0; padding: 0; background: #fff; }
* { box-sizing: border-box; }

body {
  font-family: 'PMingLiU','Microsoft JhengHei', serif;
  color: #111;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page-wrapper {
  width: 210mm;            /* A4 全寬 */
  min-height: 297mm;       /* A4 全高 */
  position: relative;
  margin: 0 auto;
  background: #fff;
  padding: 0;              /* 外層不留白 */
}

.inner {
  position: relative;
  z-index: 20;
  padding: 8mm 6mm 8mm 6mm; /* 內容留白搬到 inner */
}

/* 四角色塊貼邊 */
.corner {
  position: absolute;
  width: 8mm;
  height: 32mm;
  background: ${color};
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
  font-size: 13px;                       /* 原本 12，放大 */
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

// 針對 MS Word 友善調整的 HTML 結構 (拿掉 absolute, 100% height 等容易跑版的屬性)
const getTemplateHTML = (color: string, data?: any) => `
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
              <td style="height:22px; ${data?.triage_level === 1 ? `background:${color};font-weight:700;` : ''}">Ⅰ</td>
              <td style="${data?.triage_level === 2 ? `background:${color};font-weight:700;` : ''}">Ⅱ</td>
              <td style="${data?.triage_level === 3 ? `background:${color};font-weight:700;` : ''}">Ⅲ</td>
              <td style="${data?.triage_level === 4 ? `background:${color};font-weight:700;` : ''}">Ⅳ</td>
              <td style="${data?.triage_level === 5 ? `background:${color};font-weight:700;` : ''}">Ⅴ</td>
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
          ${!["自行", "門診", "119", "他院"].some(k => safe(data?.patient_source).includes(k)) ? "☑" : "☐"} 其他：
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

const getWordCSS = (color: string) => `
  @page { size: A4 portrait; margin: 10mm; }
  html, body { margin:0; padding:0; }
  body { font-family:'PMingLiU','Microsoft JhengHei',serif; color:#111; }

  /* Word 不穩定的排版先關掉 */
  .corner { display:none !important; }
  .page-wrapper {
    width: 190mm !important;
    min-height: auto !important;
    margin: 0 auto !important;
    padding: 0 !important;
    position: static !important;
  }
  .inner { position: static !important; }

  table {
    width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    mso-table-lspace: 0pt !important;
    mso-table-rspace: 0pt !important;
  }
  td, th {
    border: 1px solid #444 !important;
    padding: 2px 4px !important;
    vertical-align: top !important;
    font-size: 12px !important;
    line-height: 1.2 !important;
  }
  .no-b td, .no-b th { border: none !important; }

  /* 原本模板有 float / flex，Word 會亂掉，改成可相容行為 */
  table[style*="float:right"] {
    float: none !important;
    margin-left: auto !important;
    margin-right: 0 !important;
    margin-top: 8px !important;
  }
  div[style*="display:flex"] {
    display: table !important;
    width: 100% !important;
  }
  div[style*="display:flex"] > div {
    display: table-cell !important;
    width: 33% !important;
  }
`;

export default function EmergencyTriageReport({ patientData, onBack }: Props) {
  const [reportData, setReportData] = useState<any>(null);
  const [content, setContent] = useState(() => getTemplateHTML(TRIAGE_COLOR));
  const [showSentModal, setShowSentModal] = useState(false);

  useEffect(() => {
    if (!patientData?.triage_id) return;

    const fetchReport = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:9000";
        const url = `${API_BASE_URL}/triage-report/${patientData.triage_id}`;
        console.log("[triage-report] request:", url);

        const res = await fetch(url);
        const result = await res.json();

        console.log("[triage-report] status:", res.status);
        console.log("[triage-report] raw result:", result);
        console.log("[triage-report] data:", result?.data);

        if (res.ok && result?.success) {
          setReportData(result.data);
        } else {
          console.error("[triage-report] API 回傳失敗", result);
        }
      } catch (err) {
        console.error("[triage-report] 抓檢傷報告失敗", err);
      }
    };

    fetchReport();
  }, [patientData?.triage_id]);

  useEffect(() => {
    console.log("[triage-report] reportData state:", reportData);
    setContent(getTemplateHTML(TRIAGE_COLOR, reportData));
  }, [reportData]);

  const PRINT_CSS = getPrintCSS(TRIAGE_COLOR);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) { alert("請允許彈出視窗以列印"); return; }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>急診檢傷報告</title>
          <style>${PRINT_CSS}</style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const exportWord = () => {
    // 改回使用目前已驗證正常的網頁/列印版 CSS
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>急診檢傷</title>
        <style>${PRINT_CSS}</style>
      </head>
      <body>${content}</body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "急診檢傷報告.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToDoctor = () => {
    setShowSentModal(true);
    setTimeout(() => { setShowSentModal(false); onBack(); }, 2000);
  };

  const levelCellStyle = (level: any, n: number, color: string) =>
  Number(level) === n ? `background:${color};font-weight:700;` : "";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">檢傷結果</h1>

      <div className="flex gap-2 flex-wrap">
        <button onClick={exportWord} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">下載 Word</button>
        <button onClick={handlePrint} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">列印</button>
        <button onClick={handleSendToDoctor} className="px-3 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 ml-auto">確定傳送給醫師</button>
      </div>

      <div className="bg-white border rounded">
        <Editor
          apiKey="o0kc5i3tv655cpqx4e0to83ci2l0ic1ep5pw0f9flef12vyr"
          value={content}
          onEditorChange={(newValue) => setContent(newValue)}
          init={{
            height: 1120,
            menubar: true,
            plugins: ["table", "lists", "searchreplace", "wordcount"],
            toolbar: "undo redo | bold italic underline | alignleft aligncenter alignright | table",
            promotion: false,
            branding: false,
            statusbar: false,
            content_style: PRINT_CSS,
            valid_elements: "*[*]",
            extended_valid_elements: "*[*]",
            entity_encoding: "raw",
            verify_html: false,
            cleanup: false,
            fix_list_elements: false,
            forced_root_block: false,
          }}
        />
      </div>

            {showSentModal && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center">
                  <div className="text-lg font-semibold text-green-600">已傳送給醫師</div>
                </div>
              </div>
            )}
          </div>
        );
      }