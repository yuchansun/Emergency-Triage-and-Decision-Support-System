import React, { useMemo, useState } from "react";

type HistoryPageProps = {
  patientData?: any;
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
  emergencyStatus: "待處置" | "處置中" | "已完成" | "轉住院";
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
  fromDate: string;
  toDate: string;
  gender: string;
  birthFrom: string;
  birthTo: string;
  emergencyStatus: string;
  triageLevel: string;
};

const PAGE_SIZE = 20;

const defaultFilter: FilterForm = {
  keyword: "",
  fromDate: "",
  toDate: "",
  gender: "",
  birthFrom: "",
  birthTo: "",
  emergencyStatus: "",
  triageLevel: "",
};

const MOCK_DATA: TriageRecord[] = Array.from({ length: 40 }).map((_, i) => {
  const idx = i + 1;
  const level = ((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  const g = idx % 2 === 0 ? "M" : "F";
  const statusList: TriageRecord["emergencyStatus"][] = ["待處置", "處置中", "已完成", "轉住院"];
  const status = statusList[idx % statusList.length];
  const day = String((idx % 28) + 1).padStart(2, "0");
  const hour = String((idx * 2) % 24).padStart(2, "0");
  const min = String((idx * 7) % 60).padStart(2, "0");

  const symptomsPool = ["頭暈", "噁心", "胸悶", "呼吸喘", "腹痛", "外傷疼痛", "發燒", "意識改變"];
  const finalSymptoms = [symptomsPool[idx % symptomsPool.length], symptomsPool[(idx + 2) % symptomsPool.length]];

  return {
    triageId: `MRN-202604${String((idx % 9) + 1).padStart(2, "0")}-${String(100000 + idx)}-A${(idx % 9) + 1}F${idx % 10}`,
    patientId: `P${String(9000000 + idx)}`,
    name: `病患${idx}`,
    gender: g,
    birthday: `19${80 + (idx % 20)}-${String((idx % 12) + 1).padStart(2, "0")}-${String((idx % 28) + 1).padStart(2, "0")}`,
    age: 20 + (idx % 55),
    idNumber: `A12${String(100000 + idx)}`,
    triageLevel: level,
    emergencyStatus: status,
    chiefComplaintNote: `護理師記錄：病人約三小時前發生車禍，主訴持續不適，伴隨活動時疼痛加劇。`,
    finalSymptoms,
    arrivalAt: `2026-04-${day} ${hour}:${min}`,
    nurseId: `N${String((idx % 9) + 1).padStart(2, "0")}`,
    vitals: {
      temperature: Number((36 + (idx % 4) + 0.2).toFixed(1)),
      heartRate: 65 + (idx % 40),
      respRate: 14 + (idx % 10),
      spo2: 93 + (idx % 7),
      bpSys: 100 + (idx % 40),
      bpDia: 60 + (idx % 20),
      bloodSugar: 90 + (idx % 60),
      weight: 45 + (idx % 35),
      gcsE: (idx % 4) + 1,
      gcsV: (idx % 5) + 1,
      gcsM: (idx % 6) + 1,
      painScore: idx % 11,
    },
    tocc: {
      travel: idx % 3 === 0 ? "有" : "無",
      travelStart: idx % 3 === 0 ? "2026-03-20" : "",
      travelEnd: idx % 3 === 0 ? "2026-03-25" : "",
      occupation: idx % 4 === 0 ? "醫護" : "一般",
      occupationOther: idx % 4 === 0 ? "急診支援" : "",
      contactItems: idx % 2 === 0 ? ["確診者接觸"] : [],
      clusterItems: idx % 3 === 0 ? ["家庭群聚"] : [],
      clusterOther: idx % 5 === 0 ? "公司同事多人不適" : "",
      symptoms: finalSymptoms,
    },
  };
});

const levelColor = (level: number) =>
  ({
    1: "text-red-700 bg-red-50 border-red-200",
    2: "text-orange-700 bg-orange-50 border-orange-200",
    3: "text-yellow-700 bg-yellow-50 border-yellow-200",
    4: "text-green-700 bg-green-50 border-green-200",
    5: "text-blue-700 bg-blue-50 border-blue-200",
  }[level] || "text-gray-700 bg-gray-50 border-gray-200");

const HistoryPage: React.FC<HistoryPageProps> = () => {
  const [form, setForm] = useState<FilterForm>(defaultFilter);
  const [applied, setApplied] = useState<FilterForm>(defaultFilter);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TriageRecord | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setField = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const filtered = useMemo(() => {
    const kw = applied.keyword.trim().toLowerCase();

    const latestFirst = [...MOCK_DATA].sort((a, b) => b.arrivalAt.localeCompare(a.arrivalAt));

    return latestFirst.filter((r) => {
      const arrivalDate = r.arrivalAt.slice(0, 10);

      const textMatch =
        !kw ||
        r.name.toLowerCase().includes(kw) ||
        r.patientId.toLowerCase().includes(kw) ||
        r.triageId.toLowerCase().includes(kw) ||
        r.idNumber.toLowerCase().includes(kw) ||
        r.chiefComplaintNote.toLowerCase().includes(kw) ||
        r.finalSymptoms.join(" ").toLowerCase().includes(kw);

      const fromMatch = !applied.fromDate || arrivalDate >= applied.fromDate;
      const toMatch = !applied.toDate || arrivalDate <= applied.toDate;
      const genderMatch = !applied.gender || r.gender === applied.gender;
      const birthFromMatch = !applied.birthFrom || r.birthday >= applied.birthFrom;
      const birthToMatch = !applied.birthTo || r.birthday <= applied.birthTo;
      const statusMatch = !applied.emergencyStatus || r.emergencyStatus === applied.emergencyStatus;
      const levelMatch = !applied.triageLevel || String(r.triageLevel) === applied.triageLevel;

      return (
        textMatch &&
        fromMatch &&
        toMatch &&
        genderMatch &&
        birthFromMatch &&
        birthToMatch &&
        statusMatch &&
        levelMatch
      );
    });
  }, [applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const handleSearch = () => {
    setApplied(form);
    setPage(1);
  };

  const resetFilters = () => {
    setForm(defaultFilter);
    setApplied(defaultFilter);
    setPage(1);
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

            <div className="xl:col-span-2">
              <label className="text-xs text-gray-600">到院日期（起）</label>
              <input type="date" value={form.fromDate} onChange={(e) => setField("fromDate", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="xl:col-span-2">
              <label className="text-xs text-gray-600">到院日期（迄）</label>
              <input type="date" value={form.toDate} onChange={(e) => setField("toDate", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="xl:col-span-2">
              <label className="text-xs text-gray-600">性別</label>
              <select value={form.gender} onChange={(e) => setField("gender", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white">
                <option value="">全部</option>
                <option value="M">男</option>
                <option value="F">女</option>
              </select>
            </div>

            <div className="xl:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full px-3 py-2 rounded-xl border border-blue-200 text-blue-600 bg-blue-50 text-sm hover:bg-blue-100"
              >
                {showAdvanced ? "收合進階" : "進階查詢"}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-600">生日（起）</label>
                <input type="date" value={form.birthFrom} onChange={(e) => setField("birthFrom", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-xs text-gray-600">生日（迄）</label>
                <input type="date" value={form.birthTo} onChange={(e) => setField("birthTo", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-xs text-gray-600">急診狀態</label>
                <select value={form.emergencyStatus} onChange={(e) => setField("emergencyStatus", e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white">
                  <option value="">全部</option>
                  <option value="待處置">待處置</option>
                  <option value="處置中">處置中</option>
                  <option value="已完成">已完成</option>
                  <option value="轉住院">轉住院</option>
                </select>
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
          )}

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
            <span className="text-sm text-gray-500">{`共 ${filtered.length} 筆`}</span>
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
                  <th className="text-left px-4 py-3">狀態</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((r) => (
                  <tr key={r.triageId} onClick={() => setSelected(r)} className="border-t border-gray-100 hover:bg-blue-50/60 cursor-pointer">
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
                    <td className="px-4 py-3">{r.emergencyStatus}</td>
                  </tr>
                ))}

                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      查無符合條件資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">第 {currentPage} / {totalPages} 頁（每頁 {PAGE_SIZE} 筆）</div>
            <div className="flex gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
              >
                上一頁
              </button>
              <button
                disabled={currentPage >= totalPages}
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
            <div className={`rounded-xl border px-4 py-3 mb-4 ${levelColor(selected.triageLevel)}`}>
              <div className="text-xs">檢傷級數</div>
              <div className="text-xl font-bold">第 {selected.triageLevel} 級</div>
            </div>

            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold text-gray-800">檢傷紀錄詳情</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">✕</button>
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
              <div><div className="text-gray-500">急診狀態</div><div className="font-semibold">{selected.emergencyStatus}</div></div>
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