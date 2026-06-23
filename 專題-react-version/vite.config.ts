import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const apiProxy = {
  '/auth': 'http://127.0.0.1:8000',
  '/patients': 'http://127.0.0.1:8000',
  '/triagesave': 'http://127.0.0.1:8000',
  '/triage_hierarchy': 'http://127.0.0.1:8000',
  '/cc_with_counts': 'http://127.0.0.1:8000',
  '/history': 'http://127.0.0.1:8000',
  '/triage-report': 'http://127.0.0.1:8000',
  '/nurses': 'http://127.0.0.1:8000',
  '/stats': 'http://127.0.0.1:8000',
}

const llmProxy = {
  '/api': 'http://127.0.0.1:8001',
}

const nhicardProxy = {
  '/nhicard-proxy': {
    target: 'http://127.0.0.1:8002',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/nhicard-proxy/, ''),
  },
}

function buildProxy(
  entries: Record<string, string | { target: string; changeOrigin?: boolean; rewrite?: (path: string) => string }>
) {
  const proxy: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(entries)) {
    proxy[path] =
      typeof value === 'string'
        ? { target: value, changeOrigin: true }
        : value
  }
  return proxy
}

function isIpadMode(env: Record<string, string>): boolean {
  return env.VITE_USE_SAME_ORIGIN === 'true' || env.VITE_USE_SAME_ORIGIN === '1'
}

// 預設（npm run dev）：http://localhost:5173，API 直連 127.0.0.1
// iPad 模式（npm run dev:ipad 或 .env 設 VITE_USE_SAME_ORIGIN=true）：
//   https://localhost:5173 + 區域網路 + 反向代理
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ipadMode = isIpadMode(env)

  const proxy = {
    ...buildProxy(apiProxy),
    ...buildProxy(llmProxy),
    ...nhicardProxy,
  }

  return {
    plugins: ipadMode ? [react(), basicSsl()] : [react()],
    ...(ipadMode && {
      server: {
        host: '0.0.0.0',
        port: 5173,
        proxy,
      },
      preview: {
        host: '0.0.0.0',
        port: 5173,
        proxy,
      },
    }),
  }
})
