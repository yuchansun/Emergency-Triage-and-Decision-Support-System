import React, { useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

type Props = {
  patientData: any;
  onBack: () => void;
};

const TEMPLATE_HTML = `
  <h2>急診檢傷報告</h2>
  <p><strong>檢傷 ID：</strong>MRN-20260319-709566-9373</p>
  <p><strong>病患姓名：</strong>黃大銘</p>
  <p><strong>年齡 / 性別：</strong>35 / 男</p>
  <p><strong>檢傷級數：</strong>第3級</p>
  <p><strong>就診時間：</strong>2026-03-19 10:00</p>
  <p><strong>床位 / 護理師：</strong>A-01 / 測試護理師</p>
  <p><strong>主訴：</strong>胸悶、呼吸不順 2 小時</p>

  <table border="1" style="border-collapse: collapse; width: 100%;">
    <tbody>
      <tr>
        <td><strong>項目</strong></td>
        <td><strong>數值</strong></td>
        <td><strong>項目</strong></td>
        <td><strong>數值</strong></td>
      </tr>
      <tr>
        <td>體溫</td>
        <td>36.8°C</td>
        <td>心跳</td>
        <td>88 bpm</td>
      </tr>
      <tr>
        <td>呼吸</td>
        <td>18 /min</td>
        <td>血氧</td>
        <td>98%</td>
      </tr>
      <tr>
        <td>血壓</td>
        <td>120/78 mmHg</td>
        <td>疼痛分數</td>
        <td>4/10</td>
      </tr>
    </tbody>
  </table>
`;

export default function EmergencyTriageReport({ onBack }: Props) {
  const [content, setContent] = useState(TEMPLATE_HTML);

  const exportWord = () => {
    const bodyHtml = `
      <h1 style="margin:0 0 12px 0;">急診檢傷報告</h1>
      ${content}
    `;

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>急診檢傷報告</title></head>
      <body>${bodyHtml}</body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `急診檢傷報告-黃大銘.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">急診檢傷報告</h1>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-3 py-2 rounded bg-gray-200">
          返回
        </button>
        <button onClick={exportWord} className="px-3 py-2 rounded bg-blue-600 text-white">
          下載 Word
        </button>
      </div>

      <div className="bg-white border rounded">
        <Editor
          apiKey="o0kc5i3tv655cpqx4e0to83ci2l0ic1ep5pw0f9flef12vyr"
          value={content}
          onEditorChange={(newValue) => setContent(newValue)}
          init={{
            height: 620,
            menubar: "file edit view insert format table tools",
            plugins: [
              "anchor", "autolink", "charmap", "codesample", "emoticons",
              "link", "lists", "media", "searchreplace", "table", "visualblocks", "wordcount"
            ],
            toolbar:
              "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | " +
              "alignleft aligncenter alignright alignjustify | numlist bullist | " +
              "table | link media | removeformat",
            promotion: false,
            branding: false,
            statusbar: false
          }}
        />
      </div>
    </div>
  );
}
