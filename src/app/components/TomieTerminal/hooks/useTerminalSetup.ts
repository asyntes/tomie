import { useEffect, useRef, useState } from 'react';
import { Mood } from '../../../types/mood';
import { Language } from '../../../i18n/useI18n';
import { Message } from '../../../types/message';

const WELCOME_MESSAGE_IDS = ['1', '2', '3', '4', '5'] as const;

type TranslateFn = (key: string, params?: Record<string, string>) => string;

type TerminalSetupOptions = {
  t: TranslateFn;
  isLocaleReady: boolean;
  language: Language;
};

const buildWelcomeMessages = (t: TranslateFn): Message[] => [
  {
    id: '1',
    text: t('welcome.initialized'),
    isUser: false,
    timestamp: new Date(),
    mood: 'neutral' as Mood
  },
  {
    id: '2',
    text: t('welcome.connection'),
    isUser: false,
    timestamp: new Date(),
    mood: 'neutral' as Mood
  },
  {
    id: '3',
    text: t('welcome.help'),
    isUser: false,
    timestamp: new Date(),
    mood: 'neutral' as Mood
  },
  {
    id: '4',
    text: t('welcome.privacy'),
    isUser: false,
    timestamp: new Date(),
    mood: 'neutral' as Mood
  },
  {
    id: '5',
    text: t('welcome.greeting'),
    isUser: false,
    timestamp: new Date(),
    mood: 'excited' as Mood
  }
];

const isUntouchedWelcome = (messages: Message[]): boolean => {
  if (messages.length === 0) {
    return true;
  }

  if (messages.some((message) => message.isUser)) {
    return false;
  }

  if (messages.length !== WELCOME_MESSAGE_IDS.length) {
    return false;
  }

  return messages.every((message, index) => message.id === WELCOME_MESSAGE_IDS[index]);
};

export const useTerminalSetup = ({
  t,
  isLocaleReady,
  language,
}: TerminalSetupOptions) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const welcomeLanguageRef = useRef<Language | null>(null);

  useEffect(() => {
    if (!isLocaleReady) {
      return;
    }

    const nextWelcomeMessages = buildWelcomeMessages(t);

    if (!isInitialized) {
      setMessages(nextWelcomeMessages);
      welcomeLanguageRef.current = language;
      setIsInitialized(true);
      return;
    }

    if (welcomeLanguageRef.current === language) {
      return;
    }

    setMessages((previousMessages) => (
      isUntouchedWelcome(previousMessages) ? nextWelcomeMessages : previousMessages
    ));
    welcomeLanguageRef.current = language;
  }, [isLocaleReady, isInitialized, language, t]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const touchDevice =
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

    setIsTouchDevice(touchDevice);

    const handleOrientationChange = () => {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no, interactive-widget=resizes-content'
        );
      }
      setTimeout(() => {
        document.body.style.setProperty('zoom', '1');
        document.documentElement.style.setProperty('zoom', '1');
        document.body.style.transform = 'scale(1)';
        document.documentElement.style.transform = 'scale(1)';
        void document.body.offsetHeight;
      }, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return {
    isInitialized: isInitialized && isLocaleReady,
    isTouchDevice,
    messages,
    setMessages
  };
};
