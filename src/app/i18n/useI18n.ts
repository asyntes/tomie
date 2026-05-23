import { useState, useEffect } from 'react';
import enTranslations from './en.json';
import itTranslations from './it.json';

export type Language = 'en' | 'it';

export interface Translations {
  terminal: {
    initializing: string;
    mood: string;
    processing: string;
    typing: string;
    placeholder: string;
    send: string;
  };
  welcome: {
    initialized: string;
    connection: string;
    help: string;
    privacy: string;
    greeting: string;
  };
  moods: {
    neutral: string;
    angry: string;
    romantic: string;
    excited: string;
    confused: string;
  };
  commands: {
    cleared: string;
    help: string;
    repo: string;
    unknown: string;
  };
  privacy: {
    title: string;
    dataProcessing: string;
    bulletPoints: string[];
    securityTitle: string;
    securityIntro: string;
    securityPoints: string[];
    thirdPartyTitle: string;
    thirdPartyPoints: string[];
    retention: string;
    questions: string;
    links: string[];
    lastUpdated: string;
  };
}

const translations: Record<Language, Translations> = {
  en: enTranslations,
  it: itTranslations,
};

const detectLanguage = (): Language => {
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('it') ? 'it' : 'en';
  }
  return 'en';
};

export const useI18n = () => {
  const [language, setLanguage] = useState<Language>('en');
  const [isLocaleReady, setIsLocaleReady] = useState(false);

  useEffect(() => {
    setLanguage(detectLanguage());
    setIsLocaleReady(true);
  }, []);

  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (text, [param, replacement]) => text.replace(`{${param}}`, replacement),
        value
      );
    }

    return value;
  };

  const formatPrivacyPolicy = (): string => {
    const privacy = translations[language].privacy;

    let policy = `${privacy.title}\n\n`;
    policy += `${privacy.dataProcessing}\n`;

    privacy.bulletPoints.forEach((point: string) => {
      policy += `- ${point}\n`;
    });

    policy += `\n${privacy.securityTitle}\n`;
    policy += `${privacy.securityIntro}\n`;

    privacy.securityPoints.forEach((point: string) => {
      policy += `- ${point}\n`;
    });

    policy += `\n${privacy.thirdPartyTitle}\n`;

    privacy.thirdPartyPoints.forEach((point: string) => {
      policy += `- ${point}\n`;
    });

    policy += `\n${privacy.retention}\n\n`;
    policy += `${privacy.questions}\n`;

    privacy.links.forEach((link: string) => {
      policy += `- ${link}\n`;
    });

    policy += `\n${privacy.lastUpdated} ${new Date().toLocaleDateString()}`;

    return policy;
  };

  return {
    language,
    setLanguage,
    t,
    formatPrivacyPolicy,
    isLocaleReady,
  };
};