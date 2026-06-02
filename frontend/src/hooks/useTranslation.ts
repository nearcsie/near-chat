"use client";

import { useChat } from "@/context/ChatContext";
import zhTW from "@/locales/zh-TW.json";
import en from "@/locales/en.json";

const translations = {
  "zh-TW": zhTW,
  en: en,
} as const;

export function useTranslation() {
  const { uiLanguage } = useChat();

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split(".");
    let current: any = translations[uiLanguage] || translations["zh-TW"];

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        console.warn(`Translation key not found: ${key} for locale: ${uiLanguage}`);
        return key;
      }
    }

    if (typeof current !== "string") {
      return key;
    }

    let text = current;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, "g"), String(v));
      });
    }

    return text;
  };

  return { t, locale: uiLanguage };
}
