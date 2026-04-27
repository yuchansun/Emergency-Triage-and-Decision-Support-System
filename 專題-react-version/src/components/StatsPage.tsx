import React, { useMemo, useState } from "react";

type RangeKey = "today" | "week" | "month";

type TriageStatRecord = {
  triageId: string;
  gender: "M" | "F";
  age: number;
  triageLevel: 1 | 2 | 3 | 4 | 5;
  arrivalAt: string; // YYYY-MM-DD HH:mm
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateKey = (value: string) => value.slice(0, 10);

const formatDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;

const makeMockRecords = (): TriageStatRecord[] => {
  const base = new Date("2026-04-12T12:00:00");
  const ages = [8, 15, 22, 28, 34, 41, 48, 56, 63, 72];

  return Array.from({ length: 48 }).map((_, i) => {
    const offsetDays =
      i < 4 ? 0 : i < 12 ? i - 3 : i < 24 ? (i - 11) % 7 + 1 : (i - 23) % 18 + 2;

    const d = new Date(base);
    d.setDate(d.getDate() - offsetDays);
    d.setHours(8 + (i % 10), (i * 7) % 60, 0, 0);

    return {
      triageId: `TRI-${String(i + 1).padStart(3, "0")}`,
      gender: i % 2 === 0 ? "M" : "F",
      age: ages[i % ages.length],
      triageLevel: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      arrivalAt: formatDateTime(d),
    };
  });
};

const MOCK_RECORDS = makeMockRecords();

const levelMeta = [
  { label: "第1級", value: 1, color: "bg-red-500" },
  { label: "第2級", value: 2, color: "bg-orange-500" },
  { label: "第3級", value: 3, color: "bg-yellow-500" },
  { label: "第4級", value: 4, color: "bg-green-500" },
  { label: "第5級", value: 5, color: "bg-blue-500" },
] as const;

const ageMeta = [
  { label: "0–18", min: 0, max: 18, color: "bg-sky-500" },
  { label: "19–30", min: 19, max: 30, color: "bg-cyan-500" },
  { label: "31–45", min: 31, max: 45, color: "bg-emerald-500" },
  { label: "46–60", min: 46, max: 60, color: "bg-amber-500" },
  { label: "61+", min: 61, max: Infinity, color: "bg-rose-500" },
];

const tabs: { key: RangeKey; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
];

const StatsPage: React.FC = () => {
  const [range, setRange] = useState<RangeKey>("month");

  const filteredRecords = useMemo(() => {
    const now = new Date("2026-04-12T12:00:00");
    const nowKey = toDateKey(formatDateTime(now));
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();

    return MOCK_RECORDS.filter((record) => {
      const recordDate = new Date(record.arrivalAt.replace(" ", "T"));
      const recordKey = toDateKey(record.arrivalAt);

      if (range === "today") return recordKey === nowKey;

      if (range === "week") {
        const diffDays = Math.floor(
          (now.getTime() -
            new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate()).getTime()) /
            86400000
        );
        return diffDays >= 0 && diffDays < 7;
      }

      return recordDate.getFullYear() === nowYear && recordDate.getMonth() === nowMonth;
    });
  }, [range]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const male = filteredRecords.filter((r) => r.gender === "M").length;
    const female = filteredRecords.filter((r) => r.gender === "F").length;
    const avgAge =
      total > 0 ? (filteredRecords.reduce((sum, r) => sum + r.age, 0) / total).toFixed(1) : "0.0";

    const levelCounts = levelMeta.map((item) => ({
      ...item,
      count: filteredRecords.filter((r) => r.triageLevel === item.value).length,
    }));

    const ageCounts = ageMeta.map((item) => ({
      ...item,
      count: filteredRecords.filter((r) => r.age >= item.min && r.age <= item.max).length,
    }));

    return {
      total,
      male,
      female,
      avgAge,
      levelCounts,
      ageCounts,
    };
  }, [filteredRecords]);

  const currentLabel = tabs.find((t) => t.key === range)?.label ?? "本月";

  return (
    <div className="px-6 py-8 mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">統計分析</h1>
          <p className="text-gray-500 mt-1">
            目前僅使用系統現有欄位統計：檢傷級數、年齡、性別、到院時間
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRange(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                range === tab.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">{currentLabel}檢傷筆數</div>
          <div className="mt-2 text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="mt-1 text-xs text-gray-500">依到院時間篩選</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">平均年齡</div>
          <div className="mt-2 text-2xl font-bold text-gray-800">{stats.avgAge} 歲</div>
          <div className="mt-1 text-xs text-blue-600">目前區間統計</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">男性</div>
          <div className="mt-2 text-2xl font-bold text-gray-800">{stats.male}</div>
          <div className="mt-1 text-xs text-blue-600">目前區間統計</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">女性</div>
          <div className="mt-2 text-2xl font-bold text-gray-800">{stats.female}</div>
          <div className="mt-1 text-xs text-pink-600">目前區間統計</div>
        </div>
      </div> */}

      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">主要統計</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-500">本區間筆數</div>
                <div className="mt-1 text-2xl font-bold text-gray-800">{stats.total}</div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-500">本區間人數</div>
                <div className="mt-1 text-2xl font-bold text-gray-800">{stats.male}</div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-500">平均年齡</div>
                <div className="mt-1 text-2xl font-bold text-gray-800">{stats.avgAge} 歲</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-3">性別分布</h3>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#3b82f6 0% ${
                        stats.total ? (stats.male / stats.total) * 100 : 0
                      }%, #ec4899 ${stats.total ? (stats.male / stats.total) * 100 : 0}% 100%)`,
                    }}
                  />
                  <div className="relative z-10 bg-white w-20 h-20 rounded-full flex flex-col items-center justify-center">
                    <div className="text-base font-bold text-gray-800">{stats.total}</div>
                    <div className="text-xs text-gray-500">總筆數</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-700">男</span>
                    <span className="text-gray-500">{stats.male} 筆</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-pink-500" />
                    <span className="text-gray-700">女</span>
                    <span className="text-gray-500">{stats.female} 筆</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm min-w-0">
          <h2 className="text-lg font-bold text-gray-800 mb-4">分布統計</h2>

          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-gray-800 mb-3">各級數分布</h3>
              <div className="space-y-3">
                {stats.levelCounts.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="text-gray-500">{item.count} 筆</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${stats.total ? (item.count / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-800 mb-3">各年齡分布</h3>
              <div className="space-y-3">
                {stats.ageCounts.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.label} 歲</span>
                      <span className="text-gray-500">{item.count} 筆</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${stats.total ? (item.count / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;