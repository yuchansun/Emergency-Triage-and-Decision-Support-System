import OpenCC from 'opencc-js';

let cnToTwp: ((text: string) => string) | null = null;

/** 簡體（及大陸用詞）→ 台灣繁體，對齊後端 OpenCC `s2twp`。 */
export function toTaiwanTraditional(text: string): string {
  if (typeof text !== 'string' || !text) {
    return text ?? '';
  }
  try {
    if (!cnToTwp) {
      cnToTwp = OpenCC.Converter({ from: 'cn', to: 'twp' });
    }
    return cnToTwp(text);
  } catch {
    return text;
  }
}
