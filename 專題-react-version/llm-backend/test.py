import google.generativeai as genai

# 將你的 API Key 直接貼在這裡取代這串文字
TEST_API_KEY = "AIzaSyBNoSghMPuTNXXyO7BijakAnbEGZyFsAS4"

print("🔧 正在設定金鑰...")
genai.configure(api_key=TEST_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

try:
    print("🚀 正在向 Google 發送獨立測試請求...")
    response = model.generate_content("請回覆我『金鑰活著』")
    print("\n✅ 測試成功！Gemini 回覆內容：", response.text)
except Exception as e:
    print("\n❌ 測試失敗！抓到真實錯誤訊息：")
    print(e)