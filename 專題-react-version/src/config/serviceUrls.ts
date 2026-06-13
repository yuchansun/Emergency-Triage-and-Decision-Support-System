/**
 * 服務網址：VITE_USE_SAME_ORIGIN=true 時走 Vite 反向代理（同源 HTTPS），
 * iPad 用 Mac 的 .local 網址開啟即可，換 Wi‑Fi 不必改 IP。
 */
function useSameOrigin(): boolean {
  return (
    import.meta.env.VITE_USE_SAME_ORIGIN === 'true' ||
    import.meta.env.VITE_USE_SAME_ORIGIN === '1'
  );
}

/** FastAPI 資料庫 API（port 8000） */
export function getApiBaseUrl(): string {
  if (useSameOrigin()) return '';
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
}

/** LLM 後端（port 8001） */
export function getLlmBaseUrl(): string {
  if (useSameOrigin()) return '';
  return import.meta.env.VITE_LLM_BASE_URL || 'http://127.0.0.1:8001';
}

/** 健保卡讀卡服務（port 8002，經 /nhicard-proxy 轉發） */
export function getNhicardBaseUrl(): string {
  if (useSameOrigin()) return '/nhicard-proxy';
  return import.meta.env.VITE_NHICARD_URL || 'http://127.0.0.1:8002';
}
