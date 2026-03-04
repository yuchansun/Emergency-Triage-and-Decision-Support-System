import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign, BorderStyle } from 'docx';

import type { PatientData } from './AddPatient';

interface Props {
  patientData: PatientData | null;
  inputText: string;
  selectedSymptoms: Set<string>;
  worstSelectedDegree: number | null;
  bed?: string;
  patientSource?: string;
  majorIncident?: string;
  onBack: () => void;
}

const EmergencyTriageReport: React.FC<Props> = ({ patientData, inputText, selectedSymptoms, worstSelectedDegree, bed, patientSource, majorIncident, onBack }) => {
  // 可在報告頁手動補充的欄位
  const [supplementText, setSupplementText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // 簡易可編輯的生命徵象欄位（若主畫面無法傳入，使用手動輸入）
  const [temperature, setTemperature] = useState<string>('36.8');
  const [heartRate, setHeartRate] = useState<string>('80');
  const [spo2, setSpo2] = useState<string>('98');
  const [respRate, setRespRate] = useState<string>('18');
  const [systolic, setSystolic] = useState<string>('120');
  const [diastolic, setDiastolic] = useState<string>('80');
  const [bloodSugar, setBloodSugar] = useState<string>('95');
  const [gcs, setGcs] = useState<string>('E4 V5 M6');
  const [weight, setWeight] = useState<string>('70');
  const [painScore, setPainScore] = useState<string>('0');

  // 過去病史、禁治療、過敏
  const [pastHistory, setPastHistory] = useState<Record<string, boolean>>({
    none: true,
    hypertension: false,
    diabetes: false,
    heartDisease: false,
    lungDisease: false,
    cancer: false,
    other: false,
  });
  const [pastHistoryOther, setPastHistoryOther] = useState<string>('');

  const [prohibitedTreatments, setProhibitedTreatments] = useState<string>('');

  const [allergyStatus, setAllergyStatus] = useState<'none' | 'unknown' | 'has'>('none');
  const [allergyDetails, setAllergyDetails] = useState<string>('');

  // 快速填入範例資料
  const fillExample = () => {
    setSupplementText('患者主訴胸悶、呼吸困難 2 小時，伴胸痛。');
    setTemperature('36.8');
    setHeartRate('110');
    setSpo2('92');
    setRespRate('24');
    setSystolic('110');
    setDiastolic('70');
    setBloodSugar('95');
    setGcs('E4 V5 M6');
    setWeight('68');
    setPainScore('6');
    setPastHistory({ none: false, hypertension: true, diabetes: false, heartDisease: false, lungDisease: false, cancer: false, other: false });
    setAllergyStatus('has');
    setAllergyDetails('盤尼西林');
    setProhibitedTreatments('DNR');
    setNotes('建議立即給氧、心電圖與血液檢查。');
  };

  const symptomsList = Array.from(selectedSymptoms).map(s => s.replace(/^[^:]+:/, ''));

  // Helper: build a formal .docx Document for export
  const makeFormalDoc = (
    title: string,
    patientInfoRows: [string, string][],
    vitalsRows: [string, string][],
    summary: string,
    symptoms: string[],
    recommendation: string,
    notesText: string,
    pastHistoryText: string,
    allergyText: string,
    prohibitedText: string,
    hospitalName: string
  ) => {
    // small helper to pull value from patientInfoRows by key
    const getVal = (key: string) => {
      const found = patientInfoRows.find(([k]) => k === key);
      return found ? found[1] : '—';
    };

    // Header: left (hospital + dept) and right (date)
    const headerLeft = new Paragraph({
      children: [
        new TextRun({ text: hospitalName || '', bold: true, size: 28 }),
        new TextRun({ text: '\n急診部', size: 20 }),
      ],
    });

    const headerRight = new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: new Date().toLocaleString(), size: 18 })],
    });

    // Header as a two-column table so the date stays on the right while hospital info remains left
    const headerTable = new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [headerLeft], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [headerRight], verticalAlign: VerticalAlign.CENTER }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const titleParagraph = new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    });

    // Patient basic info: mimic the on-screen multi-column layout (wider value columns, lighter grid)
    const patientTable = new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '病患姓名', bold: true })] })] }),
            new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, children: [new Paragraph(getVal('姓名'))] }),
            new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '身分證字號', bold: true })] })] }),
            new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, children: [new Paragraph(getVal('身分證'))] }),
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '病歷號碼', bold: true })] })] }),
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph(getVal('病歷號'))] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '性別', bold: true })] })] }),
            new TableCell({ children: [new Paragraph(getVal('年齡/性別'))] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '婚姻狀況', bold: true })] })] }),
            new TableCell({ children: [new Paragraph('—')] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '出生地', bold: true })] })] }),
            new TableCell({ children: [new Paragraph('—')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '生日', bold: true })] })] }),
            new TableCell({ children: [new Paragraph(getVal('到院時間'))] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '地址', bold: true })] })], columnSpan: 3 }),
            new TableCell({ children: [new Paragraph('—')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '家用電話(H)', bold: true })] })] }),
            new TableCell({ children: [new Paragraph('(02) 12345678')] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '公司電話(O)', bold: true })] })] }),
            new TableCell({ children: [new Paragraph('(02) 12345678')] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'E-mail', bold: true })] })] }),
            new TableCell({ children: [new Paragraph('—')] }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        bottom: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        left: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        right: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        insideHorizontal: { size: 1, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        insideVertical: { size: 1, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
      },
    });

    // Emergency contacts / registration (simple paragraphs and small table)
    const contactsParagraph = new Paragraph({ children: [new TextRun({ text: '緊急聯絡人', bold: true })] });
    const contactsDetails = new Paragraph({ children: [new TextRun({ text: `緊急連絡人：張爸　關係：父　家用電話(H)：(02) 12345678　E-mail：22223333@gmail.com\n緊急連絡人：張媽　關係：母　家用電話(H)：(02) 12345678　E-mail：22223333@gmail.com` })] });

    const registrationParagraph = new Paragraph({ children: [new TextRun({ text: '登錄資料', bold: true })] });
    const registrationDetails = new Paragraph({ children: [new TextRun({ text: `登錄者：范醫師　單位：急診部　　醫院代碼：H0001　卡號：H23456　證號：H12345\n最後簽核者：賴醫師　單位：急診部　　簽屬時間：2001-01-01` })] });

    // Vitals table (compact)
    const vitalsTableRows: TableRow[] = vitalsRows.map(([k, v]) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
        new TableCell({ children: [new Paragraph(v || '—')] }),
      ],
    }));
    const vitalsTable = new Table({ rows: vitalsTableRows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE }, bottom: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE }, left: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE }, right: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE }, insideHorizontal: { size: 1, color: 'E5E7EB' as any, style: BorderStyle.SINGLE }, insideVertical: { size: 1, color: 'E5E7EB' as any, style: BorderStyle.SINGLE } } });

    // Clinical sections
    const historyParagraph = new Paragraph({ children: [new TextRun({ text: '病史', bold: true })] });
    const historyDetail = new Paragraph({ children: [new TextRun({ text: `感染史：B型肝炎　血型：O　　其他：${pastHistoryText || '—'}` })] });

    const recentAdmission = new Paragraph({ children: [new TextRun({ text: '最近一次住院紀錄', bold: true })] });
    const recentDetail = new Paragraph({ children: [new TextRun({ text: '最近一次住院紀錄：10天前因重感冒而掛急診' })] });

    const notesSection = new Paragraph({ children: [new TextRun({ text: '檢查紀錄 / 備註', bold: true })] });
    const notesDetail = new Paragraph({ children: [new TextRun({ text: notesText || '—' })] });

    // Signature block (3 columns with underline placeholders)
    const signatureTable = new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '登錄者簽名：' })] }), new Paragraph('________________________') ] }),
            new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '確認者簽名：' })] }), new Paragraph('________________________') ] }),
            new TableCell({ width: { size: 34, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '病歷編號：' })] }), new Paragraph(getVal('病歷號')) ] }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        bottom: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        left: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        right: { size: 2, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        insideHorizontal: { size: 1, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
        insideVertical: { size: 1, color: 'E5E7EB' as any, style: BorderStyle.SINGLE },
      },
    });

    // Other summary sections
    const summaryParagraph = new Paragraph({ children: [new TextRun({ text: '主訴摘要：', bold: true }), new TextRun(` ${summary || '—'}`)] });
    const symptomsParagraph = new Paragraph({ children: [new TextRun({ text: '已選症狀：', bold: true }), new TextRun(` ${symptoms.length ? symptoms.join('; ') : '—'}`)] });
    const recommendationParagraph = new Paragraph({ children: [new TextRun({ text: '系統推薦：', bold: true }), new TextRun(` ${recommendation || '—'}`)] });
    const pastHistParagraph = new Paragraph({ children: [new TextRun({ text: '過去病史：', bold: true }), new TextRun(` ${pastHistoryText || '—'}`)] });
    const allergyParagraph = new Paragraph({ children: [new TextRun({ text: '過敏：', bold: true }), new TextRun(` ${allergyText || '—'}`)] });
    const prohibitedParagraph = new Paragraph({ children: [new TextRun({ text: '禁治療：', bold: true }), new TextRun(` ${prohibitedText || '—'}`)] });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // header row: left and right (table)
            headerTable,
            titleParagraph,
            new Paragraph({ text: '' }),
            patientTable,
            new Paragraph({ text: '' }),
            contactsParagraph,
            contactsDetails,
            new Paragraph({ text: '' }),
            registrationParagraph,
            registrationDetails,
            new Paragraph({ text: '' }),
            new Paragraph({ text: '生命徵象', heading: HeadingLevel.HEADING_2 }),
            vitalsTable,
            new Paragraph({ text: '' }),
            historyParagraph,
            historyDetail,
            new Paragraph({ text: '' }),
            recentAdmission,
            recentDetail,
            new Paragraph({ text: '' }),
            notesSection,
            notesDetail,
            new Paragraph({ text: '' }),
            summaryParagraph,
            symptomsParagraph,
            new Paragraph({ text: '' }),
            recommendationParagraph,
            new Paragraph({ text: '' }),
            pastHistParagraph,
            allergyParagraph,
            prohibitedParagraph,
            new Paragraph({ text: '' }),
            signatureTable,
          ],
        },
      ],
    });

    return doc;
  };

  const exportExampleWord = async () => {
    const patientInfoRows: [string, string][] = [
      ['病歷號', '278378'],
      ['姓名', '林小明'],
      ['年齡/性別', '45 歲 / 男'],
      ['身分證', 'A123456789'],
      ['床位', 'A-12'],
      ['來源', '急診'],
      ['大傷', '無'],
      ['到院時間', '2025-12-17 14:22'],
    ];

    const vitalsRows: [string, string][] = [
      ['體溫', '36.8 °C'],
      ['脈搏', '110 次/分'],
      ['SPO2', '92%'],
      ['呼吸', '24 次/分'],
      ['血壓', '110 / 70 mmHg'],
      ['血糖', '95 mg/dL'],
      ['GCS', 'E4 V5 M6（15 分）'],
    ];

    const doc = makeFormalDoc(
      '病例範例',
      patientInfoRows,
      vitalsRows,
      '病患主訴為胸悶、呼吸困難，伴隨胸痛加劇 2 小時。',
      ['胸痛', '呼吸困難'],
      '第 2 級（緊急）',
      '立即給氧、心電圖、血液檢查。',
      '高血壓',
      '盤尼西林',
      'DNR',
      '輔大醫院'
    );
    const blob = await Packer.toBlob(doc);
    saveAs(blob, '病例範例.docx');
  };

  const exportCurrentWord = async () => {
    const lines = [] as string[];
    lines.push(`病歷號：${patientData?.medicalNumber ?? '—'}`);
    lines.push(`姓名：${patientData?.name ?? '—'}`);
    lines.push(`年齡 / 性別：${patientData?.age ?? '—'} / ${patientData?.gender ?? '—'}`);
    lines.push(`身分證：${patientData?.idNumber ?? '—'}`);
    lines.push(`床位：${bed ?? '—'}`);
    lines.push(`來源：${patientSource ?? '—'}`);
    lines.push(`大傷：${majorIncident ?? '—'}`);
    lines.push(`到院時間：${new Date().toLocaleString()}`);
    lines.push('');
    lines.push(`主訴摘要（AI）：${inputText || '—'}`);
    lines.push(`補充資料：${supplementText || '—'}`);
    lines.push('');
    lines.push('生命徵象：');
    lines.push(`體溫：${temperature} °C`);
    lines.push(`脈搏：${heartRate} 次/分`);
    lines.push(`SPO2：${spo2} %`);
    lines.push(`呼吸：${respRate} 次/分`);
    lines.push(`血壓：${systolic} / ${diastolic} mmHg`);
    lines.push(`血糖：${bloodSugar} mg/dL`);
    lines.push(`GCS：${gcs}`);
    lines.push('');
    lines.push('已選症狀：');
    if (symptomsList.length) {
      for (const s of symptomsList) lines.push(`- ${s}`);
    } else {
      lines.push('—');
    }
    lines.push('');
    lines.push(`系統推薦：第 ${worstSelectedDegree ?? '—'} 級`);
    lines.push('');
    lines.push(`備註：${notes || '—'}`);

    const patientInfoRows: [string, string][] = [
      ['病歷號', patientData?.medicalNumber ?? '—'],
      ['姓名', patientData?.name ?? '—'],
      ['年齡/性別', `${patientData?.age ?? '—'} / ${patientData?.gender ?? '—'}`],
      ['身分證', patientData?.idNumber ?? '—'],
      ['床位', bed ?? '—'],
      ['來源', patientSource ?? '—'],
      ['大傷', majorIncident ?? '—'],
      ['到院時間', new Date().toLocaleString()],
    ];

    const vitalsRows: [string, string][] = [
      ['體溫', `${temperature} °C`],
      ['脈搏', `${heartRate} 次/分`],
      ['SPO2', `${spo2} %`],
      ['呼吸', `${respRate} 次/分`],
      ['體重', `${weight} kg`],
      ['血壓', `${systolic} / ${diastolic} mmHg`],
      ['血糖', `${bloodSugar} mg/dL`],
      ['GCS', `${gcs}`],
      ['疼痛指數', `${painScore} / 10`],
    ];

    const pastHistTxt = Object.entries(pastHistory).filter(([,v])=>v).map(([k])=> k === 'none' ? '無' : k === 'hypertension' ? '高血壓' : k === 'diabetes' ? '糖尿病' : k === 'heartDisease' ? '心臟病' : k === 'lungDisease' ? '肺部疾病' : k === 'cancer' ? '癌症' : '其他').join('; ');
    const allergyTxt = allergyStatus === 'none' ? '無' : allergyStatus === 'unknown' ? '不詳' : (allergyDetails || '—');
    const doc = makeFormalDoc('急診檢傷報告', patientInfoRows, vitalsRows, inputText || supplementText || '—', symptomsList, `第 ${worstSelectedDegree ?? '—'} 級`, notes || '—', pastHistTxt, allergyTxt, prohibitedTreatments || '—', '輔大醫院');
    const blob = await Packer.toBlob(doc);
    const fileName = `急診檢傷單_${patientData?.medicalNumber ?? 'unknown'}_${(new Date()).toISOString().slice(0,10)}.docx`;
    saveAs(blob, fileName);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 no-print">
        <h2 className="text-2xl font-bold">急診檢傷報告</h2>
        <div className="flex gap-2">
          <button onClick={fillExample} className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:shadow">填入範例</button>
          <button onClick={exportExampleWord} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:shadow">匯出病例範例 (.docx)</button>
          <button onClick={exportCurrentWord} className="px-3 py-2 bg-primary text-white rounded-md text-sm hover:shadow">匯出目前報告 (.docx)</button>
          <button onClick={onBack} className="px-3 py-2 bg-gray-100 rounded-md text-sm hover:shadow">返回</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 左側：現代簡約表單 */}
        <div className="space-y-4 form-side no-print">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-2 bg-white p-4 rounded-md shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-3 text-gray-700">病患基本資料</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="truncate">病歷號：{patientData?.medicalNumber ?? '—'}</div>
                <div className="truncate">床位：{bed ?? '—'}</div>
                <div className="truncate">姓名：{patientData?.name ?? '—'}</div>
                <div className="truncate">來源：{patientSource ?? '—'}</div>
                <div className="truncate">年齡/性別：{patientData?.age ?? '—'} / {patientData?.gender ?? '—'}</div>
                <div className="truncate">身分證：{patientData?.idNumber ?? '—'}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-2 text-gray-700">系統推薦</h3>
              <div className="text-sm text-gray-700">建議級數： <strong>{worstSelectedDegree ?? '—'}</strong></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-2 bg-white p-4 rounded-md shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-2 text-gray-700">主訴與補充</h3>
              <div className="mb-2 text-sm text-gray-600">AI 摘要： {inputText || '—'}</div>
              <label className="block text-sm font-medium mb-1 text-gray-700">補充資料</label>
              <textarea value={supplementText} onChange={(e) => setSupplementText(e.target.value)} className="w-full p-2 rounded-md border border-gray-200" rows={4} />
            </div>

            <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-2 text-gray-700">已選症狀</h3>
              <div className="flex flex-wrap gap-2">
                {symptomsList.length ? symptomsList.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">{s}</span>
                )) : <div className="text-sm text-gray-400">無</div>}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2 text-gray-700">生命徵象（可編輯）</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input value={temperature} onChange={(e) => setTemperature(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="體溫 °C" />
              <input value={heartRate} onChange={(e) => setHeartRate(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="脈搏 / 分" />
              <input value={spo2} onChange={(e) => setSpo2(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="SPO2 %" />
              <input value={respRate} onChange={(e) => setRespRate(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="呼吸 / 分" />
              <input value={systolic} onChange={(e) => setSystolic(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="收縮壓" />
              <input value={diastolic} onChange={(e) => setDiastolic(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="舒張壓" />
              <input value={bloodSugar} onChange={(e) => setBloodSugar(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="血糖 mg/dL" />
              <input value={gcs} onChange={(e) => setGcs(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="GCS" />
              <input value={weight} onChange={(e) => setWeight(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="體重 kg" />
              <input value={painScore} onChange={(e) => setPainScore(e.target.value)} className="p-2 rounded-md border border-gray-200" placeholder="疼痛指數 0-10" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2 text-gray-700">過去病史 / 過敏 / 禁治療</h3>
            <div className="grid grid-cols-2 gap-2 text-sm mb-2 text-gray-700">
              <div>
                <label className="block">病史：</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(pastHistory).map(([key, val]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={val} onChange={() => setPastHistory(prev => ({ ...prev, [key]: !prev[key] }))} />
                      <span className="text-sm">{key === 'none' ? '無' : key === 'hypertension' ? '高血壓' : key === 'diabetes' ? '糖尿病' : key === 'heartDisease' ? '心臟病' : key === 'lungDisease' ? '肺部疾病' : key === 'cancer' ? '癌症' : '其他'}</span>
                    </label>
                  ))}
                </div>
                {pastHistory.other && <input value={pastHistoryOther} onChange={(e) => setPastHistoryOther(e.target.value)} className="mt-2 p-2 rounded-md border border-gray-200 w-full" placeholder="其他病史詳情" />}
              </div>

              <div>
                <label className="block">過敏：</label>
                <div className="mt-1 flex flex-col text-sm">
                  <label className="inline-flex items-center gap-2"><input type="radio" name="allergy" checked={allergyStatus === 'none'} onChange={() => setAllergyStatus('none')} />無</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" name="allergy" checked={allergyStatus === 'unknown'} onChange={() => setAllergyStatus('unknown')} />不詳</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" name="allergy" checked={allergyStatus === 'has'} onChange={() => setAllergyStatus('has')} />有</label>
                  {allergyStatus === 'has' && <input value={allergyDetails} onChange={(e) => setAllergyDetails(e.target.value)} className="mt-2 p-2 rounded-md border border-gray-200" placeholder="過敏詳情（如：盤尼西林）" />}

                </div>

                <label className="block mt-3">禁治療詳情</label>
                <input value={prohibitedTreatments} onChange={(e) => setProhibitedTreatments(e.target.value)} className="mt-1 p-2 rounded-md border border-gray-200 w-full" placeholder="例如：DNR、DNI 等" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">備註</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 rounded-md border border-gray-200" rows={3} />
          </div>
        </div>

        {/* 右側：公文式預覽（A4 模擬） */}
        <div className="flex justify-center">
          <div className="doc-preview bg-white p-6 md:p-10 rounded shadow-md border border-gray-200 w-full max-w-[794px] text-gray-900">
            {/* Header */}
            <div className="border-b border-gray-300 pb-3 mb-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xl font-bold">輔大醫院</div>
                  <div className="text-sm">急診部</div>
                </div>
                <div className="text-sm text-right">
                  <div>文件產生時間：{new Date().toLocaleString()}</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-center mt-4">急診基本資料單</div>
            </div>

            {/* Patient basic info grid (compact, multi-column) */}
            <div className="mb-4">
              <table className="w-full text-sm table-fixed" style={{borderCollapse: 'collapse'}}>
                <tbody>
                  <tr>
                    <td className="py-2 px-2 align-top font-semibold" style={{width: '10%'}}>病患姓名</td>
                    <td className="py-2 px-2" style={{width: '24%'}}>{patientData?.name ?? '—'}</td>
                    <td className="py-2 px-2 align-top font-semibold" style={{width: '12%'}}>身分證字號</td>
                    <td className="py-2 px-2" style={{width: '24%'}}>{patientData?.idNumber ?? '—'}</td>
                    <td className="py-2 px-2 align-top font-semibold" style={{width: '10%'}}>病歷號碼</td>
                    <td className="py-2 px-2" style={{width: '20%'}}>{patientData?.medicalNumber ?? '—'}</td>
                  </tr>

                  <tr>
                    <td className="py-2 px-2 font-semibold">性別</td>
                    <td className="py-2 px-2">{patientData?.gender ?? '—'}</td>
                    <td className="py-2 px-2 font-semibold">婚姻狀況</td>
                    <td className="py-2 px-2">—</td>
                    <td className="py-2 px-2 font-semibold">出生地</td>
                    <td className="py-2 px-2">—</td>
                  </tr>

                  <tr>
                    <td className="py-2 px-2 font-semibold">生日</td>
                    <td className="py-2 px-2">{patientData?.birthDate ?? '—'}</td>
                    <td className="py-2 px-2 font-semibold">地址</td>
                    <td className="py-2 px-2" colSpan={3}>{'—'}</td>
                  </tr>

                  <tr>
                    <td className="py-2 px-2 font-semibold">家用電話(H)</td>
                    <td className="py-2 px-2">(02) 12345678</td>
                    <td className="py-2 px-2 font-semibold">公司電話(O)</td>
                    <td className="py-2 px-2">(02) 12345678</td>
                    <td className="py-2 px-2 font-semibold">E-mail</td>
                    <td className="py-2 px-2">{'—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Emergency contacts and registration info */}
            <div className="mb-4 text-sm">
              <div className="mb-2 font-semibold">緊急聯絡人</div>
              <div className="grid grid-cols-1 gap-1 text-sm">
                <div>緊急連絡人：張爸　關係：父　家用電話(H)：(02) 12345678　E-mail：22223333@gmail.com</div>
                <div>緊急連絡人：張媽　關係：母　家用電話(H)：(02) 12345678　E-mail：22223333@gmail.com</div>
              </div>
            </div>

            <div className="mb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1"><span className="font-semibold">登錄者：</span>范醫師　<span className="font-semibold">單位：</span>急診部</div>
                  <div className="mb-1"><span className="font-semibold">醫院代碼：</span>H0001　<span className="font-semibold">卡號：</span>H23456　<span className="font-semibold">證號：</span>H12345</div>
                </div>
                <div>
                  <div className="mb-1"><span className="font-semibold">最後簽核者：</span>賴醫師　單位：急診部</div>
                  <div className="mb-1"><span className="font-semibold">簽屬時間：</span>2001-01-01</div>
                </div>
              </div>
            </div>

            {/* Clinical sections: history, recent admission, labs */}
            <div className="mb-3">
              <div className="font-semibold mb-2">病史</div>
              <div className="text-sm mb-2">感染史：B型肝炎　血型：O</div>
              <div className="text-sm">其他：{pastHistory.other ? pastHistoryOther || '—' : '—'}</div>
            </div>

            <div className="mb-3">
              <div className="font-semibold mb-2">最近一次住院紀錄</div>
              <div className="text-sm">最近一次住院紀錄：10天前因重感冒而掛急診</div>
            </div>

            <div className="mb-3">
              <div className="font-semibold mb-2">檢查紀錄 / 備註</div>
              <div className="text-sm">{notes || '—'}</div>
            </div>

            {/* Signature block */}
            <div className="mt-6 pt-5 border-t text-sm">
              <div className="grid grid-cols-3 gap-4">
                <div>登錄者簽名：<div className="mt-6 border-b border-gray-400 w-full">&nbsp;</div></div>
                <div>確認者簽名：<div className="mt-6 border-b border-gray-400 w-full">&nbsp;</div></div>
                <div>病歷編號：<div className="mt-6 border-b border-gray-400 w-full">{patientData?.medicalNumber ?? '—'}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyTriageReport;
