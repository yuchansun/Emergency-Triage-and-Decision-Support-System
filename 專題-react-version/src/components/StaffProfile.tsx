export default function StaffProfile({
  nurseInfo, 
  userSettings, 
  setUserSettings,
  globalConfig,
  setGlobalConfig,
  isAdmin 
}: any) {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-3xl font-bold mb-8">個人檔案與系統設定</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 個人基本資料 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-indigo-600">基本資料</h3>
          <div className="space-y-3">
            <p><span className="text-slate-500">姓名：</span>{nurseInfo?.name || "未登入"}</p>
            <p><span className="text-slate-500">工號：</span>{nurseInfo?.nurseId || "N/A"}</p>
            <p><span className="text-slate-500">職位：</span>{nurseInfo?.role || "護理師"}</p>
            <p><span className="text-slate-500">所屬部門：</span>{nurseInfo?.department || "急診部"}</p>
          </div>
        </div>

        {/* 個人操作偏好 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-indigo-600">介面使用偏好</h3>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div>
              <p className="font-bold">顯示檢傷確認頁面</p>
              <p className="text-xs text-slate-500">存檔前是否跳轉至報告頁面核對資料</p>
            </div>
            <input 
              type="checkbox" 
              className="w-6 h-6 accent-indigo-600"
              checked={userSettings.confirmBeforeSave}
              onChange={(e) => setUserSettings({
                ...userSettings, 
                confirmBeforeSave: e.target.checked 
              })}
            />
          </div>
        </div>
      </div>

      {/* 管理者專區 */}
      {isAdmin && (
        <div className="mt-8 bg-amber-50 p-8 rounded-3xl border border-amber-200">
          <h3 className="text-lg font-bold mb-4 text-amber-800">🛠 系統管理權限 (管理員可見)</h3>
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-amber-100">
            <div>
              <p className="font-bold">強制執行 TOCC 必填</p>
              <p className="text-xs text-slate-500">開啟後，若病人資料未填寫 TOCC 將無法存檔</p>
            </div>
            <button 
              onClick={() => setGlobalConfig({
                ...globalConfig, 
                requireTOCC: !globalConfig.requireTOCC 
              })}
              className={`px-6 py-2 rounded-xl font-bold transition ${
                globalConfig.requireTOCC 
                ? "bg-red-500 text-white" 
                : "bg-slate-200 text-slate-600"
              }`}
            >
              {globalConfig.requireTOCC ? "已開啟必填" : "目前選填"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}