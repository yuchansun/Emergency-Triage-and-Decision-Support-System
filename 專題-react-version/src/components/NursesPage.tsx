import React, { useMemo, useState } from "react";

type NurseTriageRecord = {
  triageId: string;
  patientName: string;
  triageLevel: 1 | 2 | 3 | 4 | 5;
  arrivalAt: string;
  status: string;
};

type NurseRecord = {
  nurseId: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  status: string;
  phone: string;
  email: string;
  hireDate: string;
  licenseNo: string;
  triageCount: number;
  records: NurseTriageRecord[];
};

const MOCK_NURSES: NurseRecord[] = [
  {
    nurseId: "N01",
    name: "王小美",
    role: "資深護理師",
    department: "急診",
    shift: "白班",
    status: "在職",
    phone: "0912-345-678",
    email: "wang@example.com",
    hireDate: "2021-08-12",
    licenseNo: "RN-102938",
    triageCount: 18,
    records: [
      { triageId: "TRI-202604-001", patientName: "病患01", triageLevel: 2, arrivalAt: "2026-04-11 08:20", status: "已完成" },
      { triageId: "TRI-202604-017", patientName: "病患17", triageLevel: 3, arrivalAt: "2026-04-10 14:05", status: "處置中" },
    ],
  },
  {
    nurseId: "N02",
    name: "李志豪",
    role: "護理師",
    department: "急診",
    shift: "小夜",
    status: "在職",
    phone: "0922-111-222",
    email: "lee@example.com",
    hireDate: "2022-03-01",
    licenseNo: "RN-445566",
    triageCount: 12,
    records: [
      { triageId: "TRI-202604-008", patientName: "病患08", triageLevel: 4, arrivalAt: "2026-04-09 22:15", status: "已完成" },
      { triageId: "TRI-202604-013", patientName: "病患13", triageLevel: 1, arrivalAt: "2026-04-08 23:50", status: "轉住院" },
    ],
  },
  {
    nurseId: "N03",
    name: "陳怡君",
    role: "護理師",
    department: "急診",
    shift: "大夜",
    status: "在職",
    phone: "0933-222-333",
    email: "chen@example.com",
    hireDate: "2020-11-20",
    licenseNo: "RN-778899",
    triageCount: 9,
    records: [
      { triageId: "TRI-202604-021", patientName: "病患21", triageLevel: 5, arrivalAt: "2026-04-07 02:10", status: "已完成" },
      { triageId: "TRI-202604-028", patientName: "病患28", triageLevel: 2, arrivalAt: "2026-04-06 03:45", status: "處置中" },
    ],
  },
  {
    nurseId: "N04",
    name: "張淑芬",
    role: "專科護理師",
    department: "急診",
    shift: "白班",
    status: "支援中",
    phone: "0944-333-444",
    email: "chang@example.com",
    hireDate: "2019-05-18",
    licenseNo: "RN-556677",
    triageCount: 23,
    records: [
      { triageId: "MRN-20260401-100027-A1F7", patientName: "病患04", triageLevel: 1, arrivalAt: "2026-04-11 11:30", status: "已完成" },
      { triageId: "TRI-202604-019", patientName: "病患19", triageLevel: 3, arrivalAt: "2026-04-08 10:12", status: "待處置" },
    ],
  },
];

const levelColor = (level: number) =>
  ({
    1: "text-red-700 bg-red-50 border-red-200",
    2: "text-orange-700 bg-orange-50 border-orange-200",
    3: "text-yellow-700 bg-yellow-50 border-yellow-200",
    4: "text-green-700 bg-green-50 border-green-200",
    5: "text-blue-700 bg-blue-50 border-blue-200",
  }[level] || "text-gray-700 bg-gray-50 border-gray-200");

type NursesPageProps = {
  onOpenHistoryRecord?: (triageId: string) => void;
};

const NursesPage: React.FC<NursesPageProps> = ({ onOpenHistoryRecord }) => {
  const [selected, setSelected] = useState<NurseRecord | null>(null);

  const nurseSummary = useMemo(() => {
    return {
      total: MOCK_NURSES.length,
      active: MOCK_NURSES.filter((n) => n.status === "在職").length,
      support: MOCK_NURSES.filter((n) => n.status === "支援中").length,
    };
  }, []);

  return (
    <div className="px-6 py-8 mx-auto max-w-screen-2xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">護理師資料管理</h1>
            <p className="text-gray-500 mt-1">可查看護理師資料、檢傷紀錄，並預留修改資料與密碼功能</p>
          </div>

          <div className="flex gap-2 text-sm">
            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-gray-500">總數</div>
              <div className="font-semibold text-gray-800">{nurseSummary.total}</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-green-50 border border-green-200">
              <div className="text-green-600">在職</div>
              <div className="font-semibold text-green-700">{nurseSummary.active}</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-blue-600">支援中</div>
              <div className="font-semibold text-blue-700">{nurseSummary.support}</div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">護理師編號</th>
                <th className="text-left px-4 py-3">姓名</th>
                <th className="text-left px-4 py-3">職稱</th>
                <th className="text-left px-4 py-3">單位</th>
                <th className="text-left px-4 py-3">班別</th>
                <th className="text-left px-4 py-3">狀態</th>
                <th className="text-left px-4 py-3">檢傷筆數</th>
                <th className="text-left px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_NURSES.map((nurse) => (
                <tr
                  key={nurse.nurseId}
                  onClick={() => setSelected(nurse)}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{nurse.nurseId}</td>
                  <td className="px-4 py-3">{nurse.name}</td>
                  <td className="px-4 py-3">{nurse.role}</td>
                  <td className="px-4 py-3">{nurse.department}</td>
                  <td className="px-4 py-3">{nurse.shift}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                      {nurse.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{nurse.triageCount}</td>
                  <td className="px-4 py-3">
                    <span className="text-blue-600 font-medium">查看詳情</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/25" onClick={() => setSelected(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold text-gray-800">護理師資料詳情</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100"
              >
                修改資料
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100"
              >
                修改密碼
              </button>
            </div>

            <div className="mt-4 rounded-xl border px-4 py-3 bg-gray-50 border-gray-200">
              <div className="text-xs text-gray-500">護理師編號</div>
              <div className="text-xl font-bold text-gray-800">{selected.nurseId}</div>
              <div className="mt-1 text-base font-semibold text-gray-700">{selected.name}</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">姓名</div>
                <div className="font-semibold">{selected.name}</div>
              </div>
              <div>
                <div className="text-gray-500">職稱</div>
                <div className="font-semibold">{selected.role}</div>
              </div>
              <div>
                <div className="text-gray-500">單位</div>
                <div className="font-semibold">{selected.department}</div>
              </div>
              <div>
                <div className="text-gray-500">班別</div>
                <div className="font-semibold">{selected.shift}</div>
              </div>
              <div>
                <div className="text-gray-500">狀態</div>
                <div className="font-semibold">{selected.status}</div>
              </div>
              <div>
                <div className="text-gray-500">到職日期</div>
                <div className="font-semibold">{selected.hireDate}</div>
              </div>
              <div>
                <div className="text-gray-500">聯絡電話</div>
                <div className="font-semibold">{selected.phone}</div>
              </div>
              <div>
                <div className="text-gray-500">電子郵件</div>
                <div className="font-semibold">{selected.email}</div>
              </div>
              <div>
                <div className="text-gray-500">執照編號</div>
                <div className="font-semibold">{selected.licenseNo}</div>
              </div>
              <div>
                <div className="text-gray-500">檢傷筆數</div>
                <div className="font-semibold">{selected.triageCount}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold text-gray-800">此護理師的檢傷紀錄</h4>
                <span className="text-sm text-gray-500">僅 UI 顯示</span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3">檢傷號</th>
                      <th className="text-left px-4 py-3">病患姓名</th>
                      <th className="text-left px-4 py-3">檢傷級數</th>
                      <th className="text-left px-4 py-3">到院時間</th>
                      <th className="text-left px-4 py-3">狀態</th>
                      <th className="text-left px-4 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.records.map((record) => (
                      <tr
                        key={record.triageId}
                        onClick={() => onOpenHistoryRecord?.(record.triageId)}
                        className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium text-gray-800">{record.triageId}</td>
                        <td className="px-4 py-3">{record.patientName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-3 py-1 rounded-full border ${levelColor(record.triageLevel)}`}>
                            第 {record.triageLevel} 級
                          </span>
                        </td>
                        <td className="px-4 py-3">{record.arrivalAt}</td>
                        <td className="px-4 py-3">{record.status}</td>
                        <td className="px-4 py-3">
                          <span className="text-blue-600 font-medium">查看詳情</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NursesPage;