import { useState } from 'react';

type LoginProps = {
    onLogin: () => void;
};

export default function Login({ onLogin }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
            {/* 登入卡片 */}
            <div className="w-96 p-8 bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col items-center gap-6">

                {/* 標題 + Logo */}
                <div className="flex flex-col items-center gap-2">
                    <div className="text-blue-600 w-12 h-12">
                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M24 4C12.95 4 4 12.95 4 24C4 35.05 12.95 44 24 44C35.05 44 44 35.05 44 24C44 12.95 35.05 4 24 4ZM24 28H16V20H24V14L32 22L24 30V28Z" fill="currentColor"></path>
                        </svg>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 tracking-wide text-center">
                        急診檢傷系統
                    </h1>
                </div>

                {/* 帳號 */}
                <div className="w-full mb-4">
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
                <div className="w-full mb-6">
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

                {/* 底部小文字 */}
                <p className="mt-4 text-center text-gray-400 text-sm">
                    忘記密碼？請聯絡系統管理員
                </p>
            </div>
        </div>
    );
}
