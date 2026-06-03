import React, { useCallback, useEffect, useMemo, useState } from "react";

//定義資料格式
type NurseTriageRecord = {
  triageId: string;
  patientName: string;
  triageLevel: 1 | 2 | 3 | 4 | 5 | "none";
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
  isActive?: boolean;
  phone: string;
  email: string;
  hireDate: string;
  licenseNo: string;
  triageCount: number;
  records: NurseTriageRecord[];
};

type NewNurseForm = {
  name: string;
  role: string;
  department: string;
  shift: string;
  status: string;
  phone: string;
  email: string;
  hireDate: string;
  licenseNo: string;
};

const levelColor = (level: number) =>
({
  1: "text-red-700 bg-red-50 border-red-200",
  2: "text-orange-700 bg-orange-50 border-orange-200",
  3: "text-yellow-700 bg-yellow-50 border-yellow-200",
  4: "text-green-700 bg-green-50 border-green-200",
  5: "text-blue-700 bg-blue-50 border-blue-200",
}[level] || "text-gray-700 bg-gray-50 border-gray-200");

const levelStyle = (level: NurseTriageRecord["triageLevel"]) =>
  level === "none"
    ? "text-gray-600 bg-gray-50 border-gray-200"
    : levelColor(level);

const levelLabel = (level: NurseTriageRecord["triageLevel"]) =>
  level === "none" ? "none" : `第 ${level} 級`;

const toRoleLabel = (role: string) => {
  const r = (role || "").trim().toLowerCase();
  if (r === "admin" || role === "管理員") return "管理員";
  if (r === "user" || role === "護理師") return "護理師";
  return role || "";
};

const toRoleValue = (role: string) => {
  const r = (role || "").trim().toLowerCase();
  if (r === "admin" || role === "管理員") return "admin";
  if (r === "user" || role === "護理師") return "user";
  return role.trim();
};

const isNurseDisabled = (nurse: Pick<NurseRecord, "status" | "isActive">) => {
  if (typeof nurse.isActive === "boolean") return !nurse.isActive;
  return (nurse.status || "").trim() === "停用";
};

type NursesPageProps = {
  onOpenHistoryRecord?: (triageId: string) => void;
  initialSelectedNurseId?: string | null;
};

const emptyForm: NewNurseForm = {
  name: "",
  role: "護理師",
  department: "急診",
  shift: "白班",
  status: "在職",
  phone: "",
  email: "",
  hireDate: "",
  licenseNo: "",
};

const NursesPage: React.FC<NursesPageProps> = ({ onOpenHistoryRecord, initialSelectedNurseId }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const [nurses, setNurses] = useState<NurseRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [recordSearchQuery, setRecordSearchQuery] = useState<string>("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<NewNurseForm>(emptyForm);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<NurseRecord | null>(null);

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
    currentPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const selected = useMemo(
    () => nurses.find((n) => n.nurseId === selectedId) || null,
    [nurses, selectedId]
  );

  const filteredRecords = useMemo(() => {
    const query = recordSearchQuery.trim().toLowerCase();
    if (!query || !selected) return selected?.records || [];
    return (selected.records || []).filter((record) =>
      record.patientName.toLowerCase().includes(query) ||
      record.arrivalAt.toLowerCase().includes(query) ||
      record.triageId.toLowerCase().includes(query)
    );
  }, [recordSearchQuery, selected]);

  const filteredNurses = useMemo(() => {
    const query = (searchQuery || "").toString().trim().toLowerCase(); // 加入 (searchQuery || "")
  if (!query) return nurses;
  return nurses.filter((n) =>
    n.name.toLowerCase().includes(query) ||
    n.nurseId.toLowerCase().includes(query)
  );
}, [nurses, searchQuery]);

  const nurseSummary = useMemo(() => {
    return {
      total: nurses.length,
      active: nurses.filter((n) => n.status === "在職").length,
      support: nurses.filter((n) => n.status === "支援中").length,
      disabled: nurses.filter((n) => isNurseDisabled(n)).length,
    };
  }, [nurses]);

  const fetchNurses = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/nurses`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "讀取護理師資料失敗");
      }
      setNurses(result.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "讀取護理師資料失敗";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    void fetchNurses();
  }, [fetchNurses]);

useEffect(() => {
  // 只有當 initialSelectedNurseId 真的有值（非 null/undefined/空字串）時才動作
  if (!initialSelectedNurseId) return;

  const nurseNameStr = String(initialSelectedNurseId); // 強制轉成字串
  setSearchQuery(nurseNameStr);
  void openNurseDetail(nurseNameStr);
}, [initialSelectedNurseId]);

  useEffect(() => {
    setRecordSearchQuery("");
  }, [selectedId]);

  const openNurseDetail = async (nurseId: string) => {
    setSelectedId(nurseId);
    try {
      const res = await fetch(
        `${API_BASE_URL}/nurses/${encodeURIComponent(nurseId)}/records`
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "讀取檢傷紀錄失敗");
      }

      setNurses((prev) =>
        prev.map((n) =>
          n.nurseId === nurseId ? { ...n, records: result.data || [] } : n
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "讀取檢傷紀錄失敗";
      window.alert(message);
    }
  };

  const handleToggleActive = async (nurseId: string, active: boolean) => {
    const target = nurses.find((n) => n.nurseId === nurseId);
    if (!target) return;
    const actionLabel = active ? "啟用" : "停用";
    if (!window.confirm(`確定${actionLabel}帳號：${target.name}（${target.nurseId}）？`)) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/nurses/${encodeURIComponent(nurseId)}/active`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || `${actionLabel}失敗`);
      }

      setNurses((prev) =>
        prev.map((n) =>
          n.nurseId === nurseId ? { ...n, ...result.data } : n
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : `${actionLabel}失敗`;
      window.alert(message);
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      window.alert("請填寫「姓名」");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/nurses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: toRoleValue(form.role) || "user",
          department: form.department.trim() || "急診",
          shift: form.shift.trim() || "白班",
          status: form.status.trim() || "在職",
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          hireDate: form.hireDate.trim() || null,
          licenseNo: form.licenseNo.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "新增失敗");
      }

      setNurses((prev) => [result.data, ...prev]);
      setForm(emptyForm);
      setIsAddOpen(false);
      window.alert("新增成功");
    } catch (err) {
      const message = err instanceof Error ? err.message : "新增失敗";
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = () => {
    if (!selected) return;
    setEditForm({ ...selected });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selected || !editForm) return;
    if (!editForm.name.trim()) {
      window.alert("姓名不可為空");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/nurses/${encodeURIComponent(selected.nurseId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          role: toRoleValue(editForm.role),
          department: editForm.department.trim(),
          shift: editForm.shift.trim(),
          status: editForm.status.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          hireDate: editForm.hireDate.trim() || null,
          licenseNo: editForm.licenseNo.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "修改失敗");
      }

      setNurses((prev) =>
        prev.map((n) =>
          n.nurseId === selected.nurseId ? { ...n, ...result.data } : n
        )
      );
      setSelectedId(selected.nurseId);
      setIsEditOpen(false);
      window.alert("修改成功");
    } catch (err) {
      const message = err instanceof Error ? err.message : "修改失敗";
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!selected) return;
    if (!passwordForm.currentPassword?.trim()) {
      window.alert("原密碼不可為空");
      return;
    }
    if (!passwordForm.newPassword.trim()) {
      window.alert("新密碼不可為空");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      window.alert("兩次密碼不一致");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/nurses/${encodeURIComponent(selected.nurseId)}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword.trim(),
          newPassword: passwordForm.newPassword.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "修改密碼失敗");
      }

      setPasswordForm({ newPassword: "", confirmPassword: "", currentPassword: "" });
      setIsPasswordOpen(false);
      window.alert("密碼已修改");
    } catch (err) {
      const message = err instanceof Error ? err.message : "修改密碼失敗";
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-8 mx-auto max-w-screen-2xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">護理師資料管理</h1>
            <p className="text-gray-500 mt-1">
              可查看護理師資料、檢傷紀錄，並預留修改資料與密碼功能
            </p>
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              新增帳號
            </button>

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
              <div className="px-3 py-2 rounded-xl bg-gray-100 border border-gray-300">
                <div className="text-gray-600">停用</div>
                <div className="font-semibold text-gray-700">{nurseSummary.disabled}</div>
              </div>
            </div>
          </div>
        </div>

        {loading && <div className="mb-3 text-sm text-gray-500">讀取中...</div>}
        {!!errorMsg && <div className="mb-3 text-sm text-red-600">{errorMsg}</div>}

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-left md:justify-between">
          <div className="flex-1">
            <label className="text-xs text-gray-500">搜尋護理師</label>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="護理師姓名或帳號"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div className="text-sm text-gray-500">
            搜尋結果：{filteredNurses.length} / {nurses.length}
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
              {filteredNurses.map((nurse) => (
                (() => {
                  const disabled = isNurseDisabled(nurse);
                  const rowClass = disabled
                    ? "border-t border-gray-200 bg-gray-100 text-gray-400 cursor-pointer"
                    : "border-t border-gray-200 hover:bg-gray-50 cursor-pointer";
                  const statusClass = disabled
                    ? "inline-flex px-3 py-1 rounded-full bg-gray-200 text-gray-600 border border-gray-300"
                    : "inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200";
                  return (
                <tr
                  key={nurse.nurseId}
                  onClick={() => openNurseDetail(nurse.nurseId)}
                  className={rowClass}
                >
                  <td className={`px-4 py-3 font-medium ${disabled ? "text-gray-500" : "text-gray-800"}`}>{nurse.nurseId}</td>
                  <td className="px-4 py-3">{nurse.name}</td>
                  <td className="px-4 py-3">{toRoleLabel(nurse.role)}</td>
                  <td className="px-4 py-3">{nurse.department}</td>
                  <td className="px-4 py-3">{nurse.shift}</td>
                  <td className="px-4 py-3">
                    <span className={statusClass}>
                      {nurse.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{nurse.triageCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-blue-600 font-medium">查看詳情</span>
                    </div>
                  </td>
                </tr>
                  );
                })()
              ))}

              {filteredNurses.length === 0 && !loading && (
                <tr className="border-t border-gray-200">
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {nurses.length === 0 ? "目前沒有護理師帳號" : "查無符合搜尋條件"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/25" onClick={() => setSelectedId(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold text-gray-800">護理師資料詳情</h3>
              <button
                onClick={() => setSelectedId(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {!isEditOpen && !isPasswordOpen && (
              <>
                <div className="mt-4 flex gap-2">
                  {!isNurseDisabled(selected) && (
                    <>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100"
                      >
                        修改資料
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordForm({ newPassword: "", confirmPassword: "", currentPassword: "" });
                          setIsPasswordOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100"
                      >
                        修改密碼
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(selected.nurseId, isNurseDisabled(selected))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      isNurseDisabled(selected)
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {isNurseDisabled(selected) ? "啟用帳號" : "停用帳號"}
                  </button>
                </div>

                <div className="mt-4 rounded-xl border px-4 py-3 bg-gray-50 border-gray-200">
                  <div className="text-xs text-gray-500">護理師編號</div>
                  <div className="text-xl font-bold text-gray-800">{selected.nurseId}</div>
                  <div className="mt-1 text-base font-semibold text-gray-700">{selected.name}</div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><div className="text-gray-500">姓名</div><div className="font-semibold">{selected.name}</div></div>
                  <div><div className="text-gray-500">職稱</div><div className="font-semibold">{toRoleLabel(selected.role)}</div></div>
                  <div><div className="text-gray-500">單位</div><div className="font-semibold">{selected.department}</div></div>
                  <div><div className="text-gray-500">班別</div><div className="font-semibold">{selected.shift}</div></div>
                  <div><div className="text-gray-500">狀態</div><div className="font-semibold">{selected.status}</div></div>
                  <div><div className="text-gray-500">到職日期</div><div className="font-semibold">{selected.hireDate}</div></div>
                  <div><div className="text-gray-500">聯絡電話</div><div className="font-semibold">{selected.phone}</div></div>
                  <div><div className="text-gray-500">電子郵件</div><div className="font-semibold">{selected.email}</div></div>
                  <div><div className="text-gray-500">執照編號</div><div className="font-semibold">{selected.licenseNo}</div></div>
                  <div><div className="text-gray-500">檢傷筆數</div><div className="font-semibold">{selected.triageCount}</div></div>
                </div>

                <div className="mt-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-left sm:justify-between mb-3">
                    <h4 className="text-lg font-bold text-gray-800">此護理師的檢傷紀錄</h4>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-500">由後端載入</div>
                      <div className="min-w-[220px]">
                        <input
                          type="search"
                          value={recordSearchQuery}
                          onChange={(e) => setRecordSearchQuery(e.target.value)}
                          placeholder="病患姓名 / 到院時間 / 檢傷號"
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      </div>
                    </div>
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
                        {filteredRecords.map((record) => (
                          <tr
                            key={record.triageId}
                            onClick={() => onOpenHistoryRecord?.(record.triageId)}
                            className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="px-4 py-3 font-medium text-gray-800">{record.triageId}</td>
                            <td className="px-4 py-3">{record.patientName}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-3 py-1 rounded-full border ${levelStyle(record.triageLevel)}`}>
                                {levelLabel(record.triageLevel)}
                              </span>
                            </td>
                            <td className="px-4 py-3">{record.arrivalAt}</td>
                            <td className="px-4 py-3">{record.status}</td>
                            <td className="px-4 py-3">
                              <span className="text-blue-600 font-medium">查看詳情</span>
                            </td>
                          </tr>
                        ))}
                        {filteredRecords.length === 0 && (
                          <tr className="border-t border-gray-200">
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              尚無檢傷紀錄
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {isEditOpen && editForm && (
              <div className="mt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4">修改護理師資料</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">姓名 *</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">職稱</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">單位</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">班別</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.shift}
                      onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">狀態</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">聯絡電話</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">電子郵件</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">到職日期</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.hireDate}
                      onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">執照編號</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={editForm.licenseNo}
                      onChange={(e) => setEditForm({ ...editForm, licenseNo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? "儲存中..." : "儲存"}
                  </button>
                </div>
              </div>
            )}

            {isPasswordOpen && (
              <div className="mt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4">修改密碼</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">原密碼 *</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={passwordForm.currentPassword || ""}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="輸入原密碼"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">新密碼 *</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="輸入新密碼"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">確認密碼 *</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="再輸入一次新密碼"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePassword}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? "修改中..." : "修改密碼"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/25" onClick={() => setIsAddOpen(false)} />
          <div className="absolute inset-x-0 top-10 mx-auto w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">新增護理師帳號</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-600">姓名 *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">職稱</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">單位</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">班別</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.shift}
                  onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">狀態</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">聯絡電話</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">電子郵件</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">到職日期</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.hireDate}
                  onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-600">執照編號</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={form.licenseNo}
                  onChange={(e) => setForm((p) => ({ ...p, licenseNo: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "新增中..." : "新增帳號"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NursesPage;