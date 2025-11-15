import { useState } from 'react';

type LoginProps = {
  onLogin: () => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-96 p-8 bg-white rounded-2xl shadow-xl border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">系統登入</h2>

        {/* 帳號 */}
        <div className="mb-4">
          <label className="block text-gray-600 mb-1 text-sm">帳號</label>
          <input
            type="text"
            placeholder="請輸入帳號" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* 密碼 */}
        <div className="mb-6">
          <label className="block text-gray-600 mb-1 text-sm">密碼</label>
          <input
            type="password"
            placeholder="請輸入密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* 登入按鈕 */}
        <button
          onClick={onLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium shadow-md transition duration-200"
        >
          登入
        </button>

        {/*底部小文字 */}
        <p className="mt-4 text-center text-gray-400 text-sm">
          忘記密碼？請聯絡系統管理員
        </p>
      </div>
    </div>
  );
}
