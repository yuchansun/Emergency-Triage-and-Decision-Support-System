import React, { useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, BorderStyle, convertInchesToTwip } from 'docx';
import type { PatientData } from './AddPatient';

interface Props {
  patientData: PatientData | null;
  inputText: string;
  worstSelectedDegree: number | null;
  bed?: string;
  patientSource?: string;
  vitals?: Record<string, any>;
  onBack: () => void;
}

const EmergencyTriageReport: React.FC<Props> = ({
  patientData,
  inputText,
  worstSelectedDegree,
  bed,
  patientSource,
  vitals,
  onBack,
}) => {
  // 初始內容
  const initialContent = useMemo(() => `
    <h2>急診檢傷報告</h2>
    <table>
      <tr>
        <td><strong>病歷號：</strong>${patientData?.medicalNumber ?? '—'}</td>
        <td><strong>姓名：</strong>${patientData?.name ?? '—'}</td>
      </tr>
      <tr>
        <td><strong>年齡：</strong>${patientData?.age ?? '—'}</td>
        <td><strong>性別：</strong>${patientData?.gender ?? '—'}</td>
      </tr>
      <tr>
        <td><strong>床位：</strong>${bed ?? '—'}</td>
        <td><strong>來源：</strong>${patientSource ?? '—'}</td>
      </tr>
    </table>
    <hr/>
    <h3>主訴摘要</h3>
    <p>${inputText || '（無主訴輸入）'}</p>
    <hr/>
    <h3>系統推薦級數</h3>
    <p><strong>TTAS 級數：第 ${worstSelectedDegree ?? '—'} 級</strong></p>
    <hr/>
    <h3>生命徵象</h3>
    <p><strong>體溫：</strong>${vitals?.temperature ?? '—'} °C</p>
    <p><strong>脈搏：</strong>${vitals?.heartRate ?? '—'} 次/分</p>
    <p><strong>血壓：</strong>${vitals?.systolicBP ?? '—'} / ${vitals?.diastolicBP ?? '—'} mmHg</p>
    <p><strong>血氧飽和度 (SPO2)：</strong>${vitals?.spo2 ?? '—'} %</p>
    <p><strong>呼吸：</strong>${vitals?.respRate ?? '—'} 次/分</p>
    <p><strong>體重：</strong>${vitals?.weight ?? '—'} kg</p>
    <p><strong>血糖：</strong>${vitals?.bloodSugar ?? '—'} mg/dL</p>
    <hr/>
    <h3>評估</h3>
    <h4>意識狀態 (GCS)</h4>
    <p>眼睛反應：${vitals?.gcsEye ?? '—'} | 語言反應：${vitals?.gcsVerbal ?? '—'} | 運動反應：${vitals?.gcsMotor ?? '—'}</p>
    <h4>疼痛評分</h4>
    <p>${vitals?.painScore ?? '—'} / 10</p>
    <h4>過去病史</h4>
    <p>${vitals?.pastHistory ?? '—'}</p>
    <h4>藥物過敏</h4>
    <p>${vitals?.drugAllergy ?? '—'}</p>
    <h4>禁治療資訊</h4>
    <p>${vitals?.doNotTreat ?? '—'}</p>
    <hr/>
    <h3>備註</h3>
    <p>（請在此補充額外資訊）</p>
  `, [patientData, inputText, worstSelectedDegree, bed, patientSource, vitals]);

  // 初始化編輯器
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none outline-none min-h-[600px] px-4 py-3',
      },
    },
  });

  // 匯出 Word
  const exportWord = useCallback(async () => {
    if (!editor) return;

    try {
      const html = editor.getHTML();
      const parser = new DOMParser();
      const docNode = parser.parseFromString(html, 'text/html');
      const elements = Array.from(docNode.body.children);

      const paragraphs: any[] = [];

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim() || '';

        if (!text) continue;

        if (tag === 'table') {
          // 表格處理
          const rows = Array.from(el.querySelectorAll('tr')).map((row) => {
            const cells = Array.from(row.querySelectorAll('td, th')).map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun(cell.textContent?.trim() || '')],
                    }),
                  ],
                })
            );
            return new TableRow({ children: cells });
          });

          paragraphs.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                insideHorizontal: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: '000000',
                },
                insideVertical: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: '000000',
                },
              },
            })
          );
        } else if (tag === 'hr') {
          paragraphs.push(
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              },
              spacing: { after: 200 },
            })
          );
        } else {
          // 一般段落
          const isBold = tag.startsWith('h') || (el as HTMLElement).querySelector('strong') !== null;
          const isItalic = (el as HTMLElement).querySelector('em') !== null;
          const isUnderline = (el as HTMLElement).querySelector('u') !== null;

          let fontSize = 22;
          if (tag.startsWith('h')) {
            const level = parseInt(tag[1], 10);
            fontSize = Math.max(16, 40 - level * 4);
          }

          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  bold: isBold,
                  italics: isItalic,
                  underline: isUnderline ? {} : undefined,
                  size: fontSize * 2,
                  color: '000000',
                }),
              ],
              spacing: { after: 200, before: tag.startsWith('h') ? 300 : 0 },
            })
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            children: paragraphs.length > 0 ? paragraphs : [new Paragraph('無內容')],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `檢傷單_${patientData?.medicalNumber || 'unknown'}_${new Date().toISOString().split('T')[0]}.docx`);
      alert('✅ Word 檔案已成功匯出！');
    } catch (error) {
      console.error('匯出失敗:', error);
      alert('❌ 匯出失敗，請重試');
    }
  }, [editor, patientData]);

  // 工具按鈕元件
  const ToolButton = ({
    onClick,
    active,
    label,
    icon,
    tooltip,
  }: {
    onClick: () => void;
    active?: boolean;
    label: string;
    icon: React.ReactNode;
    tooltip?: string;
  }) => (
    <button
      onClick={onClick}
      type="button"
      title={tooltip || label}
      className={`px-3 py-2 rounded-lg border-2 font-medium transition-all duration-200 text-sm flex items-center gap-1 ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-md hover:bg-blue-700'
          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
      }`}
    >
      {icon}
    </button>
  );

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">編輯器載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* 標題欄 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">📋 急診檢傷報告</h1>
              <p className="text-gray-500 text-sm mt-1">
                病歷號: <span className="font-semibold text-gray-700">{patientData?.medicalNumber || '—'}</span> | 
                姓名: <span className="font-semibold text-gray-700">{patientData?.name || '—'}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportWord}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
              >
                📥 匯出 Word
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500 transition-all duration-200"
              >
                ← 返回
              </button>
            </div>
          </div>
        </div>

        {/* 工具列 */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* 文字格式 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">格式</p>
              <div className="flex gap-2">
                <ToolButton
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  active={editor.isActive('bold')}
                  icon="B"
                  label="粗體"
                  tooltip="Ctrl+B"
                />
                <ToolButton
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  active={editor.isActive('italic')}
                  icon="I"
                  label="斜體"
                  tooltip="Ctrl+I"
                />
              </div>
            </div>

            {/* 更多格式 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">更多</p>
              <div className="flex gap-2">
                <ToolButton
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  active={editor.isActive('underline')}
                  icon="U"
                  label="底線"
                  tooltip="Ctrl+U"
                />
                <ToolButton
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  active={editor.isActive('strike')}
                  icon="S"
                  label="刪除線"
                />
              </div>
            </div>

            {/* 標題 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">標題</p>
              <div className="flex gap-2">
                <ToolButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  active={editor.isActive('heading', { level: 2 })}
                  icon="H2"
                  label="中標題"
                />
                <ToolButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  active={editor.isActive('heading', { level: 3 })}
                  icon="H3"
                  label="小標題"
                />
              </div>
            </div>

            {/* 清單 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">清單</p>
              <div className="flex gap-2">
                <ToolButton
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  active={editor.isActive('bulletList')}
                  icon="•"
                  label="項目清單"
                />
                <ToolButton
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  active={editor.isActive('orderedList')}
                  icon="1."
                  label="編號清單"
                />
              </div>
            </div>

            {/* 其他 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">編輯</p>
              <div className="flex gap-2">
                <ToolButton
                  onClick={() => editor.chain().focus().clearNodes().run()}
                  icon="✖"
                  label="清除格式"
                />
              </div>
            </div>

            {/* 歷史 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">歷史</p>
              <div className="flex gap-2">
                <ToolButton
                  onClick={() => editor.chain().focus().undo().run()}
                  icon="↶"
                  label="上一步"
                />
                <ToolButton
                  onClick={() => editor.chain().focus().redo().run()}
                  icon="↷"
                  label="下一步"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 編輯區（A4 樣式） */}
        <div className="bg-white rounded-lg shadow-2xl p-12 min-h-[800px] border-4 border-gray-100">
          <EditorContent editor={editor} />
        </div>

        {/* 頁尾 */}
        <div className="text-center text-gray-500 text-sm mt-6">
          <p>自動產生時間: {new Date().toLocaleString('zh-TW')}</p>
        </div>
      </div>
    </div>
  );
};

export default EmergencyTriageReport;
