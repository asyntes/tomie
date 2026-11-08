import { useRef, useEffect, useCallback, type RefObject } from 'react';
import { Message } from '../../../types/message';

type MessageHandlingOptions = {
    isTouchDevice?: boolean;
    messagesListRef?: RefObject<HTMLDivElement | null>;
};

export const useMessageHandling = (
    messages: Message[],
    options: MessageHandlingOptions = {}
) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { isTouchDevice = false, messagesListRef } = options;

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
        const messagesList = messagesListRef?.current;
        if (messagesList) {
            if (behavior === 'smooth') {
                messagesList.scrollTo({
                    top: messagesList.scrollHeight,
                    behavior: 'smooth',
                });
            } else {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
            return;
        }

        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, [messagesListRef]);

    useEffect(() => {
        scrollToBottom(isTouchDevice ? 'auto' : 'smooth');
    }, [messages, isTouchDevice, scrollToBottom]);

    return { messagesEndRef, scrollToBottom };
};
