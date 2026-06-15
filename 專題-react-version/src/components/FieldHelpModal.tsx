import React, { useState } from 'react';
import type { FieldHelpContent, MultilingualItem } from '../config/medicalHistoryHelp';

type FieldHelpButtonProps = {
  content: FieldHelpContent;
};

const LANG_KEYS: (keyof MultilingualItem)[] = ['zh', 'en', 'ja', 'ko', 'vi', 'id'];

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

const FieldHelpButton: React.FC<FieldHelpButtonProps> = ({ content }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    copyText(text);
    setCopied(text);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors align-middle ml-1"
        title="查看多語言詢問用語"
        aria-label={`${content.title} 說明`}
      >
        <span className="material-symbols-outlined text-sm leading-none">help</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-background-dark rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-800 dark:text-text-dark">{content.title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="關閉"
              >
                <span className="material-symbols-outlined text-gray-500">close</span>
              </button>
            </div>

            <div className="px-5 py-4 space-y-6">
              <section>
                <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark mb-3">詢問病患</p>
                <div className="space-y-3">
                  {content.questions.map((line) => (
                    <p key={line} className="text-lg leading-relaxed text-gray-800 dark:text-text-dark">
                      {line}
                    </p>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark mb-3">
                  {content.commonLabel}
                  <span className="ml-2 text-xs font-normal">（點擊項目可複製中文）</span>
                </p>
                <div className="space-y-3">
                  {content.commonItems.map((item) => (
                    <button
                      key={item.zh}
                      type="button"
                      onClick={() => handleCopy(item.zh)}
                      className={
                        'w-full text-left rounded-xl border px-4 py-3 transition-colors ' +
                        (copied === item.zh
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary/40 hover:bg-primary/5')
                      }
                    >
                      {LANG_KEYS.map((key) => (
                        <p
                          key={key}
                          className={
                            key === 'zh'
                              ? 'text-base font-semibold text-gray-800 dark:text-text-dark'
                              : 'text-sm text-subtext-light dark:text-subtext-dark leading-relaxed'
                          }
                        >
                          {item[key]}
                        </p>
                      ))}
                      {copied === item.zh && (
                        <p className="text-xs text-primary font-medium mt-1">已複製</p>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FieldHelpButton;
