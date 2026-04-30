export type VoiceConsentResult = "agree" | "disagree" | "blocked";

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
    popup.document.write(`
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>語音錄音同意書</title>
  <style>
    body { margin: 0; font-family: "Microsoft JhengHei", sans-serif; background: #f3f6fb; color: #1f2937; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 20px; }
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
  <div class="wrap">
    <div class="card">
      <div class="head">語音錄音與逐字稿儲存同意書</div>
      <div class="body">
        <div>同意事項：</div>
        <ul>
          <li>同意本系統錄製語音輸入內容。</li>
          <li>同意語音轉為文字逐字稿，用於檢傷紀錄。</li>
          <li>逐字稿將依系統規範保存，以供醫療流程使用。</li>
        </ul>
        <div>若不同意，仍可進入檢傷介面，但語音按鈕會被停用。</div>
        <label class="check">
          <input id="agreeCheck" type="checkbox" />
          <span>我已閱讀並同意上述內容</span>
        </label>
      </div>
      <div class="foot">
        <button id="denyBtn" class="deny" type="button">不同意</button>
        <button id="agreeBtn" class="agree" type="button" disabled>同意</button>
      </div>
    </div>
  </div>

  <script>
    const check = document.getElementById('agreeCheck');
    const agreeBtn = document.getElementById('agreeBtn');
    const denyBtn = document.getElementById('denyBtn');

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
    `);
    popup.document.close();
  });
};
