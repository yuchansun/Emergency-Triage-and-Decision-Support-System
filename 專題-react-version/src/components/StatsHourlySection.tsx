import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const LEVEL_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#ca8a04",
  4: "#16a34a",
  5: "#2563eb",
};

type HourlyApiResponse = {
  success: boolean;
  data?: {
    hourly: Array<Record<string, number | string>>;
    todayLevelTotals: Record<string, number>;
  };
  detail?: string;
};

const SLOT_ORDER = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

/** TODO: 後端 GET /stats/hourly 穩定後可移除此假資料 fallback（目前僅在 API 失敗時使用） */
const MOCK_HOURLY: HourlyApiResponse["data"] = {
  hourly: SLOT_ORDER.map((slot, i) => ({
    slot,
    "1": (i + 1) % 3,
    "2": i % 2,
    "3": (5 - i) % 4,
    "4": i % 3,
    "5": (i + 2) % 2,
    none: 0,
  })),
  todayLevelTotals: { "1": 12, "2": 18, "3": 25, "4": 30, "5": 15, none: 0 },
};

function levelKey(n: 1 | 2 | 3 | 4 | 5) {
  return String(n) as "1" | "2" | "3" | "4" | "5";
}

const StatsHourlySection: React.FC = () => {
  const [hourlyRows, setHourlyRows] = useState<Array<Record<string, number | string>>>([]);
  const [todayTotals, setTodayTotals] = useState<Record<string, number>>({
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    none: 0,
  });
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadError("");
      try {
        const res = await fetch(`${API_BASE_URL}/stats/hourly`);
        const json = (await res.json()) as HourlyApiResponse;
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.detail || "讀取時段統計失敗");
        }
        if (cancelled) return;
        const bySlot = new Map<string, Record<string, number | string>>();
        for (const row of json.data.hourly) {
          const slot = String(row.slot ?? "");
          bySlot.set(slot, row);
        }
        const merged = SLOT_ORDER.map((slot) => {
          const base = bySlot.get(slot) || { slot };
          return {
            slot,
            "1": Number(base["1"] ?? 0),
            "2": Number(base["2"] ?? 0),
            "3": Number(base["3"] ?? 0),
            "4": Number(base["4"] ?? 0),
            "5": Number(base["5"] ?? 0),
          };
        });
        setHourlyRows(merged);
        setTodayTotals(json.data.todayLevelTotals);
      } catch {
        if (cancelled) return;
        /** TODO: 接上正式 API 後移除此 mock fallback */
        setHourlyRows(
          MOCK_HOURLY!.hourly.map((r) => ({
            slot: r.slot,
            "1": Number(r["1"] ?? 0),
            "2": Number(r["2"] ?? 0),
            "3": Number(r["3"] ?? 0),
            "4": Number(r["4"] ?? 0),
            "5": Number(r["5"] ?? 0),
          }))
        );
        setTodayTotals(MOCK_HOURLY!.todayLevelTotals);
        setLoadError("無法連線至 /stats/hourly，已顯示假資料");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const pieData = useMemo(() => {
    return ([1, 2, 3, 4, 5] as const).map((lv) => ({
      name: `第${lv}級`,
      value: todayTotals[levelKey(lv)] ?? 0,
      fill: LEVEL_COLORS[lv],
    }));
  }, [todayTotals]);

  const pieTotal = useMemo(
    () => pieData.reduce((s, d) => s + d.value, 0),
    [pieData]
  );

  const cardShell =
    "rounded-2xl shadow-md border border-gray-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 p-4 min-w-0";

  return (
    <section className="mt-10 space-y-8" aria-labelledby="stats-hourly-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="stats-hourly-heading" className="text-lg font-bold text-gray-800 dark:text-gray-100">
            時段統計
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">今日檢傷人次依級數與到院時段</p>
        </div>
        {loadError ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 shrink-0" role="status">
            {loadError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {([1, 2, 3, 4, 5] as const).map((lv) => (
          <div
            key={lv}
            className="rounded-xl sm:rounded-2xl shadow-lg px-2 py-2 sm:p-4 text-center text-white min-w-0"
            style={{ backgroundColor: LEVEL_COLORS[lv] }}
          >
            <div className="text-[11px] sm:text-sm font-medium opacity-90">第{lv}級</div>
            <div className="mt-1 sm:mt-2 text-xl sm:text-4xl font-bold tabular-nums">{todayTotals[levelKey(lv)] ?? 0}</div>
            <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs opacity-90">今日累計</div>
          </div>
        ))}
      </div>

      <div className={`${cardShell}`}>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4">今日各時段檢傷人數分布</h3>
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="slot" tick={{ fontSize: 11 }} className="text-gray-600 dark:text-gray-300" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-gray-600 dark:text-gray-300" />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Legend />
              {([1, 2, 3, 4, 5] as const).map((lv) => (
                <Bar
                  key={lv}
                  dataKey={levelKey(lv)}
                  name={`第${lv}級`}
                  stackId="triage"
                  fill={LEVEL_COLORS[lv]}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${cardShell}`}>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4">目前各級病患比例</h3>
        <div className="relative h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={1}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${Number(v ?? 0)} 人`, "人數"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
            aria-hidden
          >
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{pieTotal}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">總人數</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsHourlySection;
