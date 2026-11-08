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
import {
    canElementScrollVerticallyInDirection,
    resolveVerticalScrollLockTarget,
} from './utils/touchScrollLock';
import { useTerminalSetup } from './hooks/useTerminalSetup';
import { useMessageHandling } from './hooks/useMessageHandling';
import { LoadingDots } from './components/LoadingDots';
import { Message } from '../../types/message';
import { MoodState } from '../../types/mood';
import { useI18n } from '../../i18n/useI18n';
import styles from './TomieTerminal.module.css';

const VIEWPORT_RESYNC_DELAYS_MS = [50, 150, 300, 600] as const;
const KEYBOARD_INSET_OPEN_PX = 120;
const COARSE_POINTER_QUERY = '(pointer: coarse)';
const KEYBOARD_LAYOUT_SHRINK_RATIO = 0.75;

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
    const terminalRef = useRef<HTMLDivElement>(null);
    const messagesListRef = useRef<HTMLDivElement>(null);
    const transitionFxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [cursorPosition, setCursorPosition] = useState(0);

    const MOOD_TRANSITION_FX_MS = 550;

    const { isInitialized, isTouchDevice, messages, setMessages } = useTerminalSetup();
    const { messagesEndRef, scrollToBottom } = useMessageHandling(messages, {
        isTouchDevice,
        messagesListRef,
    });
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

    useEffect(() => {
        if (!isInitialized || !isTouchDevice || typeof window === 'undefined') {
            return;
        }

        const root = document.documentElement;
        const surfaceColor = moodColors[moodState.currentMood].bg;
        root.setAttribute('data-tomie-terminal-active', 'true');
        root.style.setProperty('--tomie-terminal-surface', surfaceColor);

        return () => {
            root.removeAttribute('data-tomie-terminal-active');
            root.style.removeProperty('--tomie-terminal-surface');
        };
    }, [isInitialized, isTouchDevice, moodState.currentMood]);

    useEffect(() => {
        if (!isInitialized || !isTouchDevice || typeof window === 'undefined') {
            return;
        }

        const root = document.documentElement;
        const terminal = terminalRef.current;
        if (!terminal) {
            return;
        }

        const lockedScrollY = window.scrollY;
        const previousHtmlOverflow = root.style.overflow;
        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPosition = document.body.style.position;
        const previousBodyTop = document.body.style.top;
        const previousBodyLeft = document.body.style.left;
        const previousBodyRight = document.body.style.right;
        const previousBodyWidth = document.body.style.width;

        const previousHtmlOverscrollBehavior = root.style.overscrollBehavior;
        const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

        root.style.overflow = 'hidden';
        root.style.overscrollBehavior = 'none';
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';

        terminal.classList.add(styles.terminalViewportLocked);

        let frameId = 0;
        const pendingTimeouts: number[] = [];
        let baselineViewportHeight = 0;
        let touchLockStartY = 0;
        let touchLockStartTarget: EventTarget | null = null;

        const safeAreaProbe = document.createElement('div');
        safeAreaProbe.setAttribute('aria-hidden', 'true');
        safeAreaProbe.style.cssText =
            'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom);';
        document.body.appendChild(safeAreaProbe);

        const clearPendingTimeouts = () => {
            while (pendingTimeouts.length > 0) {
                const timeoutId = pendingTimeouts.pop();
                if (timeoutId != null) {
                    window.clearTimeout(timeoutId);
                }
            }
        };

        const clearKeyboardFlags = () => {
            root.removeAttribute('data-tomie-keyboard-open');
            root.removeAttribute('data-tomie-keyboard-layout');
        };

        const pinMessagesToBottom = () => {
            scrollToBottom('auto');
        };

        const readViewportSampleHeight = () => {
            const visualViewportHeight = window.visualViewport?.height ?? 0;
            return Math.max(window.innerHeight, visualViewportHeight);
        };

        const isChatTextFieldFocused = () => document.activeElement === inputRef.current;

        const updateBaselineFromViewport = () => {
            if (isChatTextFieldFocused()) {
                return;
            }
            baselineViewportHeight = Math.max(baselineViewportHeight, readViewportSampleHeight());
        };

        const readSafeAreaInsetBottomPx = () =>
            Number.parseFloat(getComputedStyle(safeAreaProbe).paddingBottom) || 0;

        const syncKeyboardFlags = (visualViewport: VisualViewport) => {
            const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
            const pinchZoomed = visualViewport.scale > 1.01;
            const keyboardInset = pinchZoomed
                ? 0
                : Math.max(0, layoutHeight - visualViewport.height - visualViewport.offsetTop);
            const insetKeyboardOpen = !pinchZoomed && keyboardInset > KEYBOARD_INSET_OPEN_PX;
            const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches;
            const layoutShrinkKeyboardOpen =
                !pinchZoomed &&
                isChatTextFieldFocused() &&
                coarsePointer &&
                baselineViewportHeight > 0 &&
                visualViewport.height < baselineViewportHeight * KEYBOARD_LAYOUT_SHRINK_RATIO;
            const keyboardOpen = insetKeyboardOpen || layoutShrinkKeyboardOpen;
            const layoutKeyboardFallback =
                layoutShrinkKeyboardOpen &&
                !insetKeyboardOpen &&
                readSafeAreaInsetBottomPx() === 0;

            root.toggleAttribute('data-tomie-keyboard-open', keyboardOpen);
            root.toggleAttribute('data-tomie-keyboard-layout', layoutKeyboardFallback);
        };

        const applyVisualViewport = () => {
            const visualViewport = window.visualViewport;
            if (!visualViewport) {
                terminal.style.top = '0px';
                terminal.style.height = '100dvh';
                terminal.style.maxHeight = '100dvh';
                clearKeyboardFlags();
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(pinMessagesToBottom);
                });
                return;
            }

            updateBaselineFromViewport();
            syncKeyboardFlags(visualViewport);

            if (visualViewport.scale > 1.01) {
                const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
                terminal.style.top = '0px';
                terminal.style.height = `${layoutHeight}px`;
                terminal.style.maxHeight = `${layoutHeight}px`;
            } else {
                const visibleTop = visualViewport.offsetTop;
                const visibleHeight = visualViewport.height;
                terminal.style.top = `${visibleTop}px`;
                terminal.style.height = `${visibleHeight}px`;
                terminal.style.maxHeight = `${visibleHeight}px`;
            }

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(pinMessagesToBottom);
            });
        };

        const scheduleVisualViewportSync = () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(() => {
                frameId = 0;
                applyVisualViewport();
            });
        };

        const resyncWithDelays = () => {
            scheduleVisualViewportSync();
            clearPendingTimeouts();
            for (const delayMs of VIEWPORT_RESYNC_DELAYS_MS) {
                pendingTimeouts.push(window.setTimeout(scheduleVisualViewportSync, delayMs));
            }
        };

        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            if (target !== inputRef.current && !terminal.contains(target)) {
                return;
            }
            resyncWithDelays();
        };

        const handleFocusOut = () => {
            resyncWithDelays();
            window.scrollTo(0, 0);
        };

        const handleOrientationChange = () => {
            baselineViewportHeight = 0;
            resyncWithDelays();
        };

        const handleTouchStartForScrollLock = (event: TouchEvent) => {
            if (event.touches.length === 0) {
                return;
            }
            touchLockStartY = event.touches[0].clientY;
            touchLockStartTarget = event.target;
        };

        const handleTouchMoveForScrollLock = (event: TouchEvent) => {
            if (event.touches.length === 0) {
                return;
            }

            const deltaY = event.touches[0].clientY - touchLockStartY;
            if (deltaY === 0) {
                return;
            }

            const scrollTarget = resolveVerticalScrollLockTarget(touchLockStartTarget, [
                messagesListRef.current,
                inputRef.current,
            ]);

            if (
                scrollTarget &&
                canElementScrollVerticallyInDirection(scrollTarget, deltaY)
            ) {
                return;
            }

            event.preventDefault();
        };

        const touchMoveListenerOptions: AddEventListenerOptions = { passive: false };
        const documentTouchMoveListenerOptions: AddEventListenerOptions = {
            passive: false,
            capture: true,
        };

        baselineViewportHeight = readViewportSampleHeight();
        scheduleVisualViewportSync();

        window.visualViewport?.addEventListener('resize', scheduleVisualViewportSync);
        window.visualViewport?.addEventListener('scroll', scheduleVisualViewportSync);
        window.addEventListener('resize', scheduleVisualViewportSync);
        window.addEventListener('orientationchange', handleOrientationChange);
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        terminal.addEventListener('touchstart', handleTouchStartForScrollLock, { passive: true });
        terminal.addEventListener('touchmove', handleTouchMoveForScrollLock, touchMoveListenerOptions);
        document.addEventListener('touchstart', handleTouchStartForScrollLock, {
            passive: true,
            capture: true,
        });
        document.addEventListener(
            'touchmove',
            handleTouchMoveForScrollLock,
            documentTouchMoveListenerOptions,
        );

        return () => {
            clearPendingTimeouts();
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.visualViewport?.removeEventListener('resize', scheduleVisualViewportSync);
            window.visualViewport?.removeEventListener('scroll', scheduleVisualViewportSync);
            window.removeEventListener('resize', scheduleVisualViewportSync);
            window.removeEventListener('orientationchange', handleOrientationChange);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
            terminal.removeEventListener('touchstart', handleTouchStartForScrollLock);
            terminal.removeEventListener('touchmove', handleTouchMoveForScrollLock);
            document.removeEventListener(
                'touchstart',
                handleTouchStartForScrollLock,
                { capture: true },
            );
            document.removeEventListener(
                'touchmove',
                handleTouchMoveForScrollLock,
                documentTouchMoveListenerOptions,
            );

            terminal.classList.remove(styles.terminalViewportLocked);
            terminal.style.removeProperty('top');
            terminal.style.removeProperty('height');
            terminal.style.removeProperty('max-height');
            clearKeyboardFlags();
            safeAreaProbe.remove();

            root.style.overflow = previousHtmlOverflow;
            root.style.overscrollBehavior = previousHtmlOverscrollBehavior;
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
            document.body.style.position = previousBodyPosition;
            document.body.style.top = previousBodyTop;
            document.body.style.left = previousBodyLeft;
            document.body.style.right = previousBodyRight;
            document.body.style.width = previousBodyWidth;
            window.scrollTo(0, lockedScrollY);
        };
    }, [isInitialized, isTouchDevice, scrollToBottom]);

    const preserveInputFocusOnSendPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) {
            return;
        }
        if (event.pointerType === 'mouse') {
            return;
        }
        event.preventDefault();
    }, []);

    const preserveInputFocusOnSendMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
    }, []);

    const requestFormSubmit = useCallback((form: HTMLFormElement | null) => {
        if (!form) {
            return;
        }
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return;
        }
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, []);

    const handleTerminalClick = useCallback((e: React.MouseEvent) => {
        if (isTouchDevice) return;

        const target = e.target as HTMLElement;
        const isInputArea = target === inputRef.current || inputRef.current?.contains(target);
        const isMessageArea = target.closest('.message-content');

        if (isInputArea) {
            inputRef.current?.focus({ preventScroll: true });
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
            ref={terminalRef}
            className={`${styles.terminal} ${isGlitching ? 'glitch-active' : ''}`}
            style={{
                backgroundColor: currentColors.bg,
                color: currentColors.primary,
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

            <div className={styles.messagesColumn}>
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

                <div
                    ref={messagesListRef}
                    className={`${styles.messagesList} terminal-scrollbar`}
                >
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

            <form onSubmit={handleSubmit} className={styles.composer}>
                <div
                    className={styles.composerRow}
                    onClick={() => {
                        if (!isTouchDevice) {
                            inputRef.current?.focus({ preventScroll: true });
                        }
                    }}
                >
                    <span style={{ color: currentColors.secondary }}>{'>'}</span>
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            enterKeyHint="send"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="sentences"
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
                                if (!isTouchDevice) {
                                    updateCursorPosition();
                                }
                            }}
                            onBlur={() => {
                                setInputFocused(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing || e.keyCode === 229) {
                                    return;
                                }
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    requestFormSubmit(e.currentTarget.form);
                                }
                            }}
                            onBeforeInput={(e) => {
                                const inputEvent = e.nativeEvent;
                                if (
                                    inputEvent.inputType === 'insertLineBreak' ||
                                    inputEvent.inputType === 'insertParagraph'
                                ) {
                                    e.preventDefault();
                                    requestFormSubmit(e.currentTarget.form);
                                }
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
                        onPointerDown={preserveInputFocusOnSendPointerDown}
                        onMouseDown={preserveInputFocusOnSendMouseDown}
                        className={styles.sendButton}
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
