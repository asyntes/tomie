'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { moodColors, moodEyes } from '../../core/moodConfig';
import { generateFullResponse } from '../../core/responseHandler';
import { createInitialMoodState } from '../../core/stateManager';
import { normalizeMoodState } from '../../core/normalizeMoodState';
import { generateMoodStyles } from './utils/moodStyleGenerator';
import { typeMessage } from './utils/typingEffect';
import { handleCommand } from './utils/terminalCommands';
import { processLinksInText } from './utils/messageLinkProcessor';
import { useTerminalSetup } from './hooks/useTerminalSetup';
import { useMessageHandling } from './hooks/useMessageHandling';
import { LoadingDots } from './components/LoadingDots';
import { Message } from '../../types/message';
import { MoodState } from '../../types/mood';
import { useI18n } from '../../i18n/useI18n';
import styles from './TomieTerminal.module.css';

export default function TomieTerminal() {
    const [input, setInput] = useState('');
    const [moodState, setMoodState] = useState<MoodState>(() => createInitialMoodState());
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const [isGlitching, setIsGlitching] = useState(false);
    const [showInterference, setShowInterference] = useState(false);
    const [showLoadingDots, setShowLoadingDots] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const transitionFxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [cursorPosition, setCursorPosition] = useState(0);

    const MOOD_TRANSITION_FX_MS = 550;

    const { isInitialized, isSafari, isTouchDevice, messages, setMessages } = useTerminalSetup(inputRef);
    const { messagesEndRef } = useMessageHandling(messages);
    const { t, formatPrivacyPolicy } = useI18n();

    const updateCursorPosition = useCallback(() => {
        if (inputRef.current) {
            const tempSpan = document.createElement('span');
            tempSpan.style.font = window.getComputedStyle(inputRef.current).font;
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.position = 'absolute';
            tempSpan.style.whiteSpace = 'pre';
            tempSpan.textContent = input;

            document.body.appendChild(tempSpan);
            const textWidth = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);

            const scrollLeft = inputRef.current.scrollLeft;
            const inputWidth = inputRef.current.offsetWidth;

            let cursorPos = textWidth - scrollLeft;

            cursorPos = Math.max(0, Math.min(cursorPos, inputWidth - 10));

            setCursorPosition(cursorPos);
        }
    }, [input]);

    useEffect(() => {
        if (!isTouchDevice && inputFocused) {
            updateCursorPosition();
        }
    }, [input, inputFocused, isTouchDevice, updateCursorPosition]);

    useEffect(() => {
        return () => {
            if (transitionFxTimeoutRef.current) {
                clearTimeout(transitionFxTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (inputFocused && !isTouchDevice) {
                updateCursorPosition();
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [inputFocused, isTouchDevice, updateCursorPosition]);

    const handleTerminalClick = useCallback((e: React.MouseEvent) => {
        if (isTouchDevice) return;
        
        const target = e.target as HTMLElement;
        const isInputArea = target === inputRef.current || inputRef.current?.contains(target);
        const isMessageArea = target.closest('.message-content');
        
        if (isInputArea) {
            inputRef.current?.focus();
        } else if (!isMessageArea) {
            inputRef.current?.blur();
        }
    }, [isTouchDevice]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping || isProcessing) return;

        setIsProcessing(true);

        if (input.startsWith('/')) {
            if (handleCommand(input, setMessages, () => setMoodState(createInitialMoodState()), t, formatPrivacyPolicy)) {
                setInput('');
                setIsProcessing(false);
                return;
            }
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');

        setShowLoadingDots(true);

        const conversationMessages = messages.filter(msg => !('isSystemGenerated' in msg && msg.isSystemGenerated));

        const safeMoodState = normalizeMoodState(moodState);

        const {
            introResponse,
            aiResponse,
            newState,
            shouldChangeMood,
        } = await generateFullResponse(input, safeMoodState, conversationMessages);

        setShowLoadingDots(false);

        if (shouldChangeMood) {
            if (transitionFxTimeoutRef.current) {
                clearTimeout(transitionFxTimeoutRef.current);
            }
            setShowInterference(true);
            setIsGlitching(true);
            setMoodState(newState);
            transitionFxTimeoutRef.current = setTimeout(() => {
                setShowInterference(false);
                setIsGlitching(false);
                transitionFxTimeoutRef.current = null;
            }, MOOD_TRANSITION_FX_MS);
        } else {
            setMoodState(newState);
        }

        if (introResponse) {
            const introMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: '',
                isUser: false,
                timestamp: new Date(),
                mood: newState.currentMood,
                isSystemGenerated: true
            };

            setMessages(prev => [...prev, introMessage]);
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
            await typeMessage(introResponse, newState.currentMood, setMessages, setIsTyping, inputRef, isTouchDevice);
        }

        const displayMood = newState.currentMood;

        const grokMessage: Message = {
            id: (Date.now() + 2).toString(),
            text: '',
            isUser: false,
            timestamp: new Date(),
            mood: displayMood
        };

        setMessages(prev => [...prev, grokMessage]);
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        await typeMessage(aiResponse, displayMood, setMessages, setIsTyping, inputRef, isTouchDevice);

        setIsProcessing(false);
    };

    const currentColors = moodColors[moodState.currentMood];

    const dynamicStyles = generateMoodStyles(moodState.currentMood);

    if (!isInitialized) {
        return (
            <div
                className={styles.container}
                style={{
                    backgroundColor: currentColors.bg,
                    color: currentColors.primary
                }}
            >
                <div>{t('terminal.initializing')}</div>
            </div>
        );
    }

    return (
        <div
            className={`${styles.terminal} ${isGlitching ? 'glitch-active' : ''}`}
            style={{
                backgroundColor: currentColors.bg,
                color: currentColors.primary,
                height: isSafari && isTouchDevice ? '100vh' : '-webkit-fill-available',
                minHeight: isSafari && isTouchDevice ? '100vh' : '100vh',
                position: 'relative',
                paddingTop: isSafari && isTouchDevice ? 'env(safe-area-inset-top)' : '0',
                paddingBottom: isSafari && isTouchDevice ? 'env(safe-area-inset-bottom)' : '0'
            }}
            onClick={handleTerminalClick}
        >
            <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />

            {showInterference && (
                <div className="interference-overlay" />
            )}
            <div
                className={styles.header}
                style={{
                    borderColor: currentColors.border,
                    backgroundColor: currentColors.bg,
                    position: 'sticky',
                    top: isSafari && isTouchDevice ? 'env(safe-area-inset-top)' : '0',
                    zIndex: 50
                }}
            >
                <div className="flex items-center gap-2">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ color: currentColors.secondary }}
                    >
                        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                        <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M7 9l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13 15h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span
                        className="glitch-text"
                        data-text="Tomie AI Terminal"
                        style={{ color: currentColors.secondary }}
                    >
                        Tomie AI Terminal
                    </span>
                </div>
                <div
                    className="text-xs px-2 py-1 border rounded transition-all duration-1000"
                    style={{
                        borderColor: currentColors.border,
                        color: currentColors.secondary
                    }}
                >
                    <span
                        className="glitch-text"
                        data-text={`${t('terminal.mood')}: ${t(`moods.${moodState.currentMood}`)}`}
                    >
                        {t('terminal.mood')}: {t(`moods.${moodState.currentMood}`)}
                    </span>
                </div>
            </div>

            <div className="flex-1 relative" style={{
                height: isSafari && isTouchDevice
                    ? 'calc(100vh - 7.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))'
                    : 'calc(100vh - 7.5rem)'
            }}>
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 eye-container"
                >
                    <Image
                        src={moodEyes[moodState.currentMood]}
                        alt=""
                        width={256}
                        height={256}
                        className="w-64 h-64 object-contain"
                        style={{
                            transition: 'none',
                            transform: 'translateZ(0)'
                        }}
                        priority
                        unoptimized
                    />
                </div>

                <div className="overflow-y-auto p-4 terminal-scrollbar relative z-10 h-full">
                    {messages.map((message, index) => (
                        <div
                            key={message.id}
                            className="mb-2 transition-all duration-500 message-content"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    className="opacity-60"
                                    style={{
                                        color: currentColors.secondary,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    [{message.timestamp?.toLocaleTimeString() || '--:--:--'}]
                                </span>
                            </div>
                            <div
                                className="transition-all duration-500"
                                style={{
                                    color: message.isUser
                                        ? currentColors.secondary
                                        : currentColors.primary,
                                    fontSize: '1rem'
                                }}
                            >
                                <span
                                    className="font-bold"
                                    style={{
                                        color: message.isUser
                                            ? currentColors.secondary
                                            : currentColors.primary,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    {message.isUser ? 'USER' : 'TOMIE'}
                                </span>
                                <span className="mx-1">
                                    {'>'}
                                </span>
                                <span>
                                    {message.text.split('\n').map((line, i) => {
                                        const isLastLine = i === message.text.split('\n').length - 1;
                                        const showCursor = !message.isUser && isTyping && index === messages.length - 1 && isLastLine;

                                        return i === 0 ? (
                                            <span key={i}>
                                                {processLinksInText(line)}
                                                {showCursor && (
                                                    <span
                                                        className="ml-0.5"
                                                        style={{ color: currentColors.primary }}
                                                    >
                                                        █
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <div key={i} className="ml-12">
                                                {processLinksInText(line)}
                                                {showCursor && (
                                                    <span
                                                        className="ml-0.5"
                                                        style={{ color: currentColors.primary }}
                                                    >
                                                        █
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </span>
                            </div>
                        </div>
                    ))}
                    {showLoadingDots && (
                        <div className="mb-2 transition-all duration-500 message-content">
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    className="opacity-60"
                                    style={{
                                        color: currentColors.secondary,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    [{new Date().toLocaleTimeString()}]
                                </span>
                            </div>
                            <div
                                className="transition-all duration-500"
                                style={{
                                    color: currentColors.primary,
                                    fontSize: '1rem'
                                }}
                            >
                                <span
                                    className="font-bold"
                                    style={{
                                        color: currentColors.primary,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    TOMIE
                                </span>
                                <span className="mx-1">
                                    {'>'}
                                </span>
                                <LoadingDots color={currentColors.primary} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
                <div className="flex items-center gap-2" onClick={() => !isTouchDevice && inputRef.current?.focus()}>
                    <span style={{ color: currentColors.secondary }}>{'>'}</span>
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                            }}
                            onScroll={() => {
                                if (inputFocused) {
                                    updateCursorPosition();
                                }
                            }}
                            onFocus={() => {
                                setInputFocused(true);
                                updateCursorPosition();
                            }}
                            onBlur={() => {
                                setInputFocused(false);
                            }}
                            disabled={isTyping || isProcessing}
                            className={`w-full bg-transparent border-none outline-none terminal-input ${isTouchDevice ? '' : 'caret-transparent'}`}
                            style={{
                                color: currentColors.primary,
                                fontSize: '1rem'
                            }}
                            placeholder={isProcessing ? t('terminal.processing') : isTyping ? t('terminal.typing') : (!inputFocused ? t('terminal.placeholder') : "")}
                        />
                        {!isTyping && !isProcessing && inputFocused && !isTouchDevice && (
                            <span
                                className="absolute top-0 pointer-events-none font-mono"
                                style={{
                                    color: currentColors.primary,
                                    fontSize: '1rem',
                                    left: `${cursorPosition}px`
                                }}
                            >
                                █
                            </span>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isTyping || isProcessing || !input.trim()}
                        className="px-3 py-1 border transition-all duration-200 hover:bg-opacity-10 disabled:opacity-50"
                        style={{
                            borderColor: currentColors.border,
                            color: currentColors.secondary,
                            backgroundColor: 'transparent'
                        }}
                    >
                        {t('terminal.send')}
                    </button>
                </div>
                <div
                    className="mt-2 h-px transition-all duration-1000"
                    style={{ backgroundColor: currentColors.border }}
                />
            </form>
        </div>
    );
}