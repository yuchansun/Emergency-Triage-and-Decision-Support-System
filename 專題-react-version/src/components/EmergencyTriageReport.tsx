import React, { useState, useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";

type Props = {
  patientData?: any;
  onBack: () => void;
};

const TRIAGE_COLOR = "#FFD700";

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
const getTemplateHTML = (color: string) => `
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
              <td style="height:22px;">Ⅰ</td><td>Ⅱ</td><td>Ⅲ</td><td>Ⅳ</td><td>Ⅴ</td>
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
          <div style="margin-top:2px; font-size:11px;">到院時間 <span class="en">Arrival time：</span>2026/03/20 07:36:47</div>
        </td>
        <td style="width:25%; padding-left:4px;">
          <table>
            <tr><td class="small">2026/3/20 07:37:00</td></tr>
            <tr><td class="small">檢傷號：20260320019</td></tr>
            <tr><td class="small">病歷號 Chart No：</td></tr>
            <tr><td class="small">科別 Department：PED</td></tr>
            <tr><td class="small">床號：000</td></tr>
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
        <td></td>
        <td>性別<br><span class="en">Gender</span></td>
        <td class="c">☐ 男 M ☐ 女 F</td>
        <td class="c">010<br>歲</td>
        <td>出生日期<br><span class="en">Birthday</span></td>
        <td class="c">Year / Month / Day</td>
      </tr>
      <tr>
        <td>到院方式<br><span class="en">Mode of arrival</span></td>
        <td colspan="6">
          ☑ 自行進入 &nbsp;&nbsp; ☐ 門診轉入 &nbsp;&nbsp; ☐ 119 送入<br>
          ☐ 他院轉入，轉自：<span style="display:inline-block;width:200px;border-bottom:1px solid #000;"></span><br>
          ☐ 其他：<span style="display:inline-block;width:260px;border-bottom:1px solid #000;"></span>
        </td>
      </tr>
      <tr>
        <td>產科史<br><span class="en">Obs-Gyn History</span></td>
        <td colspan="6">
          ☐ 男性 &nbsp; ☐ 無月經/停經 &nbsp; ☐ 有懷孕 &nbsp; ☑ 無懷孕 &nbsp; ☐ 不確定<br>
          LMP：<span style="display:inline-block;width:120px;border-bottom:1px solid #000;"></span> &nbsp;&nbsp; EDC：<span style="display:inline-block;width:120px;border-bottom:1px solid #000;"></span>
        </td>
      </tr>
      <tr>
        <td>過去病史<br><span class="en">Past History</span></td>
        <td colspan="6">
          ☑ 無 &nbsp; ☐ 不詳 &nbsp; ☐ 高血壓 &nbsp; ☐ 糖尿病 &nbsp; ☐ 肺部疾病 &nbsp; ☐ 潰瘍<br>
          ☐ 氣喘 &nbsp; ☐ 癌症 &nbsp; ☐ 心臟病 &nbsp; ☐ 腦中風 &nbsp; ☐ 末期腎臟病<br>
          ☐ 其他：<span style="display:inline-block;width:340px;border-bottom:1px solid #000;"></span><br>
          ☐ 禁治療：<span style="display:inline-block;width:320px;border-bottom:1px solid #000;"></span>
        </td>
      </tr>
      <tr>
        <td>藥物過敏史<br><span class="en">Allergy History</span></td>
        <td colspan="6">
          ☑ 無 &nbsp;&nbsp; ☐ 不詳<br>
          ☐ 有：<span style="display:inline-block;width:380px;border-bottom:1px solid #000;"></span>
        </td>
      </tr>
      <tr>
        <td>意識狀態<br><span class="en">Consciousness</span></td>
        <td colspan="6">
          Glasgow Coma Scale：E <u>4</u> &nbsp; V <u>5</u> &nbsp; M <u>6</u><br>
          ☑ 無急性變化 &nbsp; ☐ 有急性變化
        </td>
      </tr>
      <tr>
        <td>生命徵象<br><span class="en">Vital Sign</span></td>
        <td colspan="6">
          T：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">36</span> ℃，&nbsp;
          P：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">125</span> 次/min，&nbsp;
          R：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">20</span> 次/min<br>
          BP：<span style="display:inline-block;width:70px;border-bottom:1px solid #000;text-align:center;">/</span> mmHg，&nbsp;
          SpO2：<span style="display:inline-block;width:35px;border-bottom:1px solid #000;text-align:center;">97</span> %，&nbsp;
          BS：<span style="display:inline-block;width:50px;border-bottom:1px solid #000;"></span>
        </td>
      </tr>
      <tr>
        <td>發燒防疫篩檢<br>TOCC</td>
        <td colspan="6">
          旅遊史：<u>無</u><br>
          職業：<u>學生</u><br>
          疾病接觸史：<u>B流</u><br>
          動物接觸史：<u>無</u><br>
          群聚史：<u>家人也有發燒或類似流感症狀</u><br>
          ☑ 咳嗽 &nbsp; ☑ 發燒
        </td>
      </tr>
      <tr>
        <td>疼痛狀態<br><span class="en">Pain Status</span></td>
        <td colspan="5" class="row-pain">疼痛程度：</td>
        <td>體重：<br>39 kg</td>
      </tr>
      <tr>
        <td colspan="7" style="height:120px; vertical-align:top; padding:6px;">
          <div>
            病人主訴：昨天開始發燒、咳嗽、有痰，7點服用過退燒藥，哥哥上週診斷B流 一般和其他-發燒/畏寒-(3)血壓或心跳有異於病人之平常數值，但血行動力穩定
          </div>
        </td>
      </tr>

      <!-- 改成主表格列，避免 Word 把檢傷人員框撐大 -->
      <tr>
        <td class="small">檢傷人員</td>
        <td class="c">陳琬玲</td>
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

export default function EmergencyTriageReport({ onBack }: Props) {
  const [content, setContent] = useState(() => getTemplateHTML(TRIAGE_COLOR));
  const [showSentModal, setShowSentModal] = useState(false);

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
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3">
            <div className="text-5xl">✅</div>
            <div className="text-xl font-bold text-gray-800">已送交 A 醫師</div>
            <div className="text-gray-400 text-sm">即將返回掛號頁面...</div>
          </div>
        </div>
      )}
    </div>
  );
}