import { useRef, useEffect, useCallback } from 'react';
import { Message } from '../../../types/message';

type MessageHandlingOptions = {
    isTouchDevice?: boolean;
};

export const useMessageHandling = (
    messages: Message[],
    options: MessageHandlingOptions = {}
) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { isTouchDevice = false } = options;

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    useEffect(() => {
        scrollToBottom('smooth');
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (!isTouchDevice || typeof window === 'undefined') return;

        const visualViewport = window.visualViewport;
        if (!visualViewport) return;

        const handleViewportChange = () => {
            scrollToBottom('auto');
        };

        visualViewport.addEventListener('resize', handleViewportChange);
        visualViewport.addEventListener('scroll', handleViewportChange);

        return () => {
            visualViewport.removeEventListener('resize', handleViewportChange);
            visualViewport.removeEventListener('scroll', handleViewportChange);
        };
    }, [isTouchDevice, scrollToBottom]);

    return { messagesEndRef, scrollToBottom };
};
