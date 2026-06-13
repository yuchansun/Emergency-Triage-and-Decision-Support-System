export type VoiceConsentResult = "agree" | "disagree" | "blocked";

const voiceConsentHTML = `
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Voice Consent</title>
  <style>
    body { margin: 0; font-family: "Microsoft JhengHei", sans-serif; background: #f3f6fb; color: #1f2937; position: relative; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 20px; }
    .lang-toggle { position: absolute; top: 20px; right: 20px; z-index: 10; }
    .lang-btn { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .lang-btn:hover { background: #1d4ed8; }
    .card { background: #fff; border-radius: 14px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15); overflow: hidden; }
    .head { background: #2563eb; color: #fff; padding: 16px 20px; font-size: 20px; font-weight: 700; }
    .body { padding: 20px; line-height: 1.7; }
    .body ul { margin: 8px 0 16px 0; padding-left: 18px; }
    .check { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; }
    .foot { display: flex; gap: 10px; padding: 16px 20px; border-top: 1px solid #e5e7eb; background: #f8fafc; }
    button { border: 0; border-radius: 10px; padding: 10px 14px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .deny { background: #d1d5db; color: #111827; }
    .agree { background: #2563eb; color: #fff; }
    .agree:disabled { background: #9ca3af; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="lang-toggle">
    <button id="langBtn" class="lang-btn" type="button">English</button>
  </div>
  <div class="wrap">
    <div class="card">
      <div class="head" id="title">Voice Recording Consent</div>
      <div class="body">
        <div id="agreeLabel">Consent Items:</div>
        <ul id="itemsList">
          <li id="item1">Item 1</li>
          <li id="item2">Item 2</li>
          <li id="item3">Item 3</li>
        </ul>
        <div id="disclaimerText">Disclaimer text</div>
        <label class="check">
          <input id="agreeCheck" type="checkbox" />
          <span id="checkboxLabel">I have read and agree</span>
        </label>
      </div>
      <div class="foot">
        <button id="denyBtn" class="deny" type="button">Disagree</button>
        <button id="agreeBtn" class="agree" type="button" disabled>Agree</button>
      </div>
    </div>
  </div>

  <script>
    const translations = {
      zh: {
        title: '語音錄音與逐字稿儲存同意書',
        agreeLabel: '同意事項：',
        items: [
          '同意本系統錄製語音輸入內容。',
          '同意語音轉為文字逐字稿，用於檢傷紀錄。',
          '逐字稿將依系統規範保存，以供醫療流程使用。'
        ],
        disclaimerText: '若不同意，仍可進入檢傷介面，但語音按鈕會被停用。',
        checkboxLabel: '我已閱讀並同意上述內容',
        denyBtn: '不同意',
        agreeBtn: '同意',
        langBtn: 'English'
      },
      en: {
        title: 'Voice Recording and Transcript Storage Consent Form',
        agreeLabel: 'Consent Items:',
        items: [
          'I agree that this system will record my voice input.',
          'I agree that voice will be converted to text transcripts for triage records.',
          'Transcripts will be stored according to system standards for medical workflow use.'
        ],
        disclaimerText: 'If you do not agree, you can still access the triage interface, but the voice button will be disabled.',
        checkboxLabel: 'I have read and agree to the above content',
        denyBtn: 'Disagree',
        agreeBtn: 'Agree',
        langBtn: '中文'
      }
    };

    let currentLang = 'zh';
    const check = document.getElementById('agreeCheck');
    const agreeBtn = document.getElementById('agreeBtn');
    const denyBtn = document.getElementById('denyBtn');
    const langBtn = document.getElementById('langBtn');

    function setLanguage(lang) {
      currentLang = lang;
      const t = translations[lang];
      
      document.getElementById('title').textContent = t.title;
      document.getElementById('agreeLabel').textContent = t.agreeLabel;
      
      const itemsList = document.getElementById('itemsList');
      t.items.forEach((item, index) => {
        const itemId = 'item' + (index + 1);
        const element = document.getElementById(itemId);
        if (element) element.textContent = item;
      });
      
      document.getElementById('disclaimerText').textContent = t.disclaimerText;
      document.getElementById('checkboxLabel').textContent = t.checkboxLabel;
      denyBtn.textContent = t.denyBtn;
      agreeBtn.textContent = t.agreeBtn;
      langBtn.textContent = t.langBtn;
      
      document.documentElement.lang = lang;
    }

    langBtn.addEventListener('click', () => {
      const newLang = currentLang === 'zh' ? 'en' : 'zh';
      setLanguage(newLang);
      localStorage.setItem('voiceConsentLang', newLang);
    });

    const savedLang = localStorage.getItem('voiceConsentLang') || 'zh';
    setLanguage(savedLang);

    check.addEventListener('change', () => {
      agreeBtn.disabled = !check.checked;
    });

    agreeBtn.addEventListener('click', () => {
      window.opener?.postMessage({ type: 'VOICE_CONSENT_RESULT', value: 'agree' }, window.location.origin);
      window.close();
    });

    denyBtn.addEventListener('click', () => {
      window.opener?.postMessage({ type: 'VOICE_CONSENT_RESULT', value: 'disagree' }, window.location.origin);
      window.close();
    });
  </script>
</body>
</html>
`;

export const openVoiceConsentPopup = (): Promise<VoiceConsentResult> => {
  return new Promise((resolve) => {
    const popup = window.open(
      "",
      "voice-consent-window",
      "width=560,height=720,top=80,left=120"
    );

    if (!popup) {
      resolve("blocked");
      return;
    }

    const cleanup = (timerId?: number) => {
      window.removeEventListener("message", onMessage);
      if (timerId) window.clearInterval(timerId);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "VOICE_CONSENT_RESULT") return;

      const value = event.data.value === "agree" ? "agree" : "disagree";
      cleanup(watchClosedTimer);
      try {
        popup.close();
      } catch {
        // ignore
      }
      resolve(value);
    };

    window.addEventListener("message", onMessage);

    const watchClosedTimer = window.setInterval(() => {
      if (popup.closed) {
        cleanup(watchClosedTimer);
        resolve("blocked");
      }
    }, 400);

    popup.document.open();
    popup.document.write(voiceConsentHTML);
    popup.document.close();
  });
};
