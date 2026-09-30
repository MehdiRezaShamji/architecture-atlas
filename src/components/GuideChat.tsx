import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { BuildingPart } from '../data/building';

export interface GuideChatProps {
  parts?: BuildingPart[];
  onSelectPart: (meshName: string | null) => void;
  onToggleIsolate: () => void;
  isIsolated: boolean;
  onExplodeChange: (value: number) => void;
  onShowParts: (meshNames: string[] | null) => void;
  accentColor?: string;
  selectedBuildingId?: string;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  isInfoPanelOpen?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface DisplayItem {
  id: string;
  type: 'message' | 'tool_call';
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  toolDescription?: string;
}

function getContrastTextColor(hexColor: string): string {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.4 ? '#232320' : '#FAFAF9';
}

const markdownComponents = {
  p: ({ children }: any) => (
    <p style={{ margin: '0 0 8px 0', lineHeight: 1.55 }}>{children}</p>
  ),
  h1: ({ children }: any) => (
    <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#232320', margin: '8px 0 4px 0', lineHeight: 1.3 }}>{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#232320', margin: '8px 0 4px 0', lineHeight: 1.3 }}>{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#232320', margin: '6px 0 2px 0', lineHeight: 1.3 }}>{children}</h3>
  ),
  strong: ({ children }: any) => (
    <strong style={{ fontWeight: 600, color: '#232320' }}>{children}</strong>
  ),
  b: ({ children }: any) => (
    <b style={{ fontWeight: 600, color: '#232320' }}>{children}</b>
  ),
  ul: ({ children }: any) => (
    <ul style={{ margin: '4px 0 8px 0', paddingLeft: '18px', lineHeight: 1.5 }}>{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol style={{ margin: '4px 0 8px 0', paddingLeft: '18px', lineHeight: 1.5 }}>{children}</ol>
  ),
  li: ({ children }: any) => (
    <li style={{ margin: '2px 0', lineHeight: 1.5 }}>{children}</li>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.08)', margin: '8px 0' }} />
  ),
  code: ({ children }: any) => (
    <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }}>{children}</code>
  ),
};

export function GuideChat({
  parts = [],
  onSelectPart,
  onToggleIsolate,
  isIsolated,
  onExplodeChange,
  onShowParts,
  accentColor = '#232320',
  selectedBuildingId,
  isOpen: controlledIsOpen,
  onToggleOpen,
  isInfoPanelOpen,
}: GuideChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const isButtonHidden = isOpen || Boolean(isInfoPanelOpen);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasBeenOpened(true);
    }
  }, [isOpen]);

  const handleToggleOpen = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep ref to latest isIsolated for tool executions inside async loop
  const isIsolatedRef = useRef(isIsolated);
  useEffect(() => {
    isIsolatedRef.current = isIsolated;
  }, [isIsolated]);

  // Reset conversation history to empty whenever the selected building changes
  useEffect(() => {
    setMessages([]);
    setDisplayItems([]);
    setInputValue('');
    setIsLoading(false);
  }, [selectedBuildingId]);

  // Auto-scroll message list when items change or panel opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayItems, isOpen, isLoading]);

  // Focus input when chat panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const buildingPartsSummary = parts.map((p) => ({
    meshName: p.meshName,
    displayName: p.displayName,
  }));

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    setMessages(newMessages);

    const userDisplayItem: DisplayItem = {
      id: `user-${Date.now()}-${Math.random()}`,
      type: 'message',
      role: 'user',
      content: text,
    };
    setDisplayItems((prev) => [...prev, userDisplayItem]);
    setIsLoading(true);

    try {
      let currentHistory = [...newMessages];
      let rounds = 0;
      const MAX_ROUNDS = 5;
      let loopFinished = false;

      while (rounds < MAX_ROUNDS && !loopFinished) {
        rounds++;

        const response = await fetch('/api/guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentHistory,
            buildingParts: buildingPartsSummary,
          }),
        });

        if (!response.ok) {
          let errorMsg = 'Failed to communicate with AI guide.';
          try {
            const errData = await response.json();
            if (errData.error) errorMsg = errData.error;
          } catch {
            // fallback to default
          }
          throw new Error(errorMsg);
        }

        const choiceMessage: ChatMessage = await response.json();
        currentHistory.push(choiceMessage);

        // If tool calls are requested
        if (choiceMessage.tool_calls && choiceMessage.tool_calls.length > 0) {
          const toolResultMessages: ChatMessage[] = [];
          const newToolDisplayItems: DisplayItem[] = [];

          // If assistant had text along with tool_calls, display it
          if (choiceMessage.content && choiceMessage.content.trim()) {
            newToolDisplayItems.push({
              id: `asst-${Date.now()}-${Math.random()}`,
              type: 'message',
              role: 'assistant',
              content: choiceMessage.content.trim(),
            });
          }

          for (const tc of choiceMessage.tool_calls) {
            const fnName = tc.function?.name;
            let args: any = {};
            try {
              args = JSON.parse(tc.function?.arguments || '{}');
            } catch {
              args = {};
            }

            let resultString = '';
            let toolNarration = '';

            switch (fnName) {
              case 'highlightPart': {
                const meshName = args.meshName;
                const part = parts.find((p) => p.meshName === meshName);
                if (!part) {
                  resultString = `Error: Unknown part "${meshName}".`;
                  toolNarration = `→ tried to highlight unknown part "${meshName}"`;
                } else {
                  onSelectPart(meshName);
                  resultString = `Highlighted ${part.displayName}.`;
                  toolNarration = `→ highlighting ${part.displayName}`;
                }
                break;
              }

              case 'isolatePart': {
                const meshName = args.meshName;
                const part = parts.find((p) => p.meshName === meshName);
                if (!part) {
                  resultString = `Error: Unknown part "${meshName}".`;
                  toolNarration = `→ tried to isolate unknown part "${meshName}"`;
                } else {
                  onShowParts(null);
                  onSelectPart(meshName);
                  if (!isIsolatedRef.current) {
                    onToggleIsolate();
                  }
                  resultString = `Isolated ${part.displayName}.`;
                  toolNarration = `→ isolating ${part.displayName}`;
                }
                break;
              }

              case 'showParts': {
                const requestedMeshes: string[] = Array.isArray(args.meshNames) ? args.meshNames : [];
                const validMeshes: string[] = [];
                const invalidMeshes: string[] = [];
                const validDisplayNames: string[] = [];

                for (const m of requestedMeshes) {
                  const part = parts.find((p) => p.meshName === m);
                  if (part) {
                    validMeshes.push(m);
                    validDisplayNames.push(part.displayName);
                  } else {
                    invalidMeshes.push(m);
                  }
                }

                if (validMeshes.length === 0) {
                  resultString = `Error: Parts not found.`;
                  toolNarration = `→ tried to show [${requestedMeshes.join(', ')}] but none were found`;
                } else {
                  // Exit single-part isolation if active
                  if (isIsolatedRef.current) {
                    onToggleIsolate();
                  }
                  // Set visible mesh names to valid subset
                  onShowParts(validMeshes);

                  const warning = invalidMeshes.length > 0
                    ? ` (Omitted: ${invalidMeshes.join(', ')})`
                    : '';
                  resultString = `Showing: ${validDisplayNames.join(', ')}.${warning}`;
                  toolNarration = `→ showing ${validDisplayNames.join(', ')} together`;
                }
                break;
              }

              case 'clearIsolation': {
                onShowParts(null);
                if (isIsolatedRef.current) {
                  onToggleIsolate();
                }
                resultString = 'Isolation cleared.';
                toolNarration = '→ showing all parts';
                break;
              }

              case 'setExplodeAmount': {
                const rawPercent = typeof args.percent === 'number' ? args.percent : parseFloat(args.percent);
                const percent = isNaN(rawPercent) ? 0 : Math.min(100, Math.max(0, rawPercent));
                onExplodeChange(percent / 100);
                resultString = `Explode set to ${percent}%.`;
                toolNarration = `→ setting exploded view to ${percent}%`;
                break;
              }

              case 'clearSelection': {
                onShowParts(null);
                onSelectPart(null);
                if (isIsolatedRef.current) {
                  onToggleIsolate();
                }
                resultString = 'Selection cleared.';
                toolNarration = '→ clearing selection';
                break;
              }

              default: {
                resultString = `Error: Unknown tool "${fnName}".`;
                toolNarration = `→ unknown tool ${fnName}`;
                break;
              }
            }

            newToolDisplayItems.push({
              id: `tool-${Date.now()}-${Math.random()}`,
              type: 'tool_call',
              toolDescription: toolNarration,
            });

            toolResultMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: resultString,
            });
          }

          // Append tool execution narration lines to display
          setDisplayItems((prev) => [...prev, ...newToolDisplayItems]);

          // Append tool results to conversation history and continue loop
          currentHistory.push(...toolResultMessages);
          setMessages([...currentHistory]);
        } else {
          // Assistant returned final message without tool calls
          loopFinished = true;
          if (choiceMessage.content && choiceMessage.content.trim()) {
            const finalDisplayItem: DisplayItem = {
              id: `asst-${Date.now()}-${Math.random()}`,
              type: 'message',
              role: 'assistant',
              content: choiceMessage.content.trim(),
            };
            setDisplayItems((prev) => [...prev, finalDisplayItem]);
          }
          setMessages([...currentHistory]);
          break;
        }
      }

      // If loop capped out at 5 rounds without terminal text
      if (!loopFinished && rounds >= MAX_ROUNDS) {
        const pauseItem: DisplayItem = {
          id: `pause-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: "Let's pause there — what would you like to know next?",
        };
        setDisplayItems((prev) => [...prev, pauseItem]);
        currentHistory.push({
          role: 'assistant',
          content: "Let's pause there — what would you like to know next?",
        });
        setMessages([...currentHistory]);
      }
    } catch (err: any) {
      console.error('[GuideChat error]:', err);
      const errorItem: DisplayItem = {
        id: `err-${Date.now()}`,
        type: 'message',
        role: 'system',
        content: err?.message || 'Guide connection interrupted. Please try again.',
      };
      setDisplayItems((prev) => [...prev, errorItem]);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonTextColor = getContrastTextColor(accentColor);

  return (
    <>
      <style>{`
        @keyframes guideButtonEntrance {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(10px);
          }
          60% {
            opacity: 1;
            transform: scale(1.03) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes guidePulseRing {
          0% {
            transform: scale(0.98);
            opacity: 0.65;
          }
          50% {
            opacity: 0.35;
          }
          100% {
            transform: scale(1.28);
            opacity: 0;
          }
        }
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .assistant-markdown > *:last-child {
          margin-bottom: 0 !important;
        }
        .assistant-markdown > *:first-child {
          margin-top: 0 !important;
        }
        @media (max-width: 640px) {
          .guide-toggle-button {
            bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
            left: 16px !important;
          }
          .guide-toggle-button.isolated {
            bottom: calc(84px + env(safe-area-inset-bottom, 0px)) !important;
            left: 16px !important;
          }
          .guide-chat-panel {
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 42vh !important;
            height: 42dvh !important;
            max-height: 42vh !important;
            max-height: 42dvh !important;
            border-radius: 16px 16px 0 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
            box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.16) !important;
            transform-origin: bottom center !important;
            z-index: 1400 !important;
          }
          .guide-panel-header {
            padding: 10px 16px !important;
          }
          .guide-messages-list {
            padding: 10px 14px !important;
            gap: 8px !important;
          }
          .guide-input-form {
            padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>

      {/* Floating Toggle Button (collapsed state, bottom-left just above hint text) */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label="Ask AI Guide"
        className={`guide-toggle-button ${isIsolated ? 'isolated' : ''}`}
        style={{
          position: 'fixed',
          bottom: isIsolated ? '84px' : '44px',
          left: '24px',
          zIndex: 1200,
          height: '46px',
          padding: '0 18px',
          borderRadius: '23px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.10)',
          color: '#232320',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px',
          fontWeight: 600,
          opacity: isButtonHidden ? 0 : 1,
          transform: isButtonHidden ? 'scale(0.92)' : 'scale(1)',
          pointerEvents: isButtonHidden ? 'none' : 'auto',
          visibility: isButtonHidden ? 'hidden' : 'visible',
          transition:
            'opacity 180ms ease, transform 180ms ease, visibility 180ms ease, bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'guideButtonEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
        onMouseEnter={(e) => {
          if (!isButtonHidden) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.13)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isButtonHidden) {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.10)';
          }
        }}
      >
        {/* Soft pulsing glow ring (continuous until chat is opened for the first time) */}
        {!hasBeenOpened && (
          <span
            style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '27px',
              border: `2px solid ${accentColor}`,
              pointerEvents: 'none',
              animation: 'guidePulseRing 2.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
            }}
          />
        )}

        {/* AI Sparkle Icon */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M12 2L13.8 8.2C14.2 9.6 15.4 10.8 16.8 11.2L23 13L16.8 14.8C15.4 15.2 14.2 16.4 13.8 17.8L12 24L10.2 17.8C9.8 16.4 8.6 15.2 7.2 14.8L1 13L7.2 11.2C8.6 10.8 9.8 9.6 10.2 8.2L12 2Z"
            fill={accentColor}
          />
          <path
            d="M19 2L19.9 4.8C20.1 5.4 20.6 5.9 21.2 6.1L24 7L21.2 7.9C20.6 8.1 20.1 8.6 19.9 9.2L19 12L18.1 9.2C17.9 8.6 17.4 8.1 16.8 7.9L14 7L16.8 6.1C17.4 5.9 17.9 5.4 18.1 4.8L19 2Z"
            fill={accentColor}
          />
        </svg>
        <span>Ask AI Guide</span>
      </button>

      {/* Slide-up Chat Panel (anchored bottom-left, expanding upward with smooth transitions) */}
      <div
        className="guide-chat-panel"
        style={{
          position: 'fixed',
          bottom: isIsolated ? '84px' : '44px',
          left: '24px',
          width: '380px',
          maxWidth: 'calc(100vw - 48px)',
          height: isIsolated ? 'min(480px, calc(100vh - 210px))' : 'min(500px, calc(100vh - 170px))',
          maxHeight: isIsolated ? 'calc(100vh - 210px)' : 'calc(100vh - 170px)',
          transformOrigin: 'bottom left',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.16)',
          zIndex: 1200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
          pointerEvents: isOpen ? 'auto' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          transition:
            'opacity 180ms ease, transform 180ms ease, visibility 180ms ease, bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
          {/* Top colored accent bar */}
          <div
            style={{
              height: '3px',
              backgroundColor: accentColor,
              width: '100%',
              flexShrink: 0,
            }}
          />

          {/* Header */}
          <div
            className="guide-panel-header"
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: accentColor,
                  display: 'inline-block',
                }}
              />
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#232320',
                    lineHeight: 1.2,
                  }}
                >
                  AI Architecture Guide
                </h3>
                <span style={{ fontSize: '11px', color: '#8A8A85' }}>
                  Interactive 3D model tour &amp; guide
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleOpen}
              aria-label="Close guide chat"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8A8A85',
                cursor: 'pointer',
                fontSize: '20px',
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#232320')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8A8A85')}
            >
              ×
            </button>
          </div>

          {/* Scrollable Message List */}
          <div
            className="guide-messages-list"
            style={{
              flex: 1,
              padding: '16px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#FAFAF9',
            }}
          >
            {displayItems.length === 0 && (
              <div
                style={{
                  margin: 'auto 0',
                  textAlign: 'center',
                  padding: '20px 10px',
                  color: '#8A8A85',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>🏛️</div>
                <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#232320' }}>
                  Ask the AI Architecture Guide
                </p>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  Ask questions about specific floors, finials, or structural elements. The AI guide can
                  highlight, isolate, and explode the model as it explains.
                </p>
              </div>
            )}

            {displayItems.map((item) => {
              if (item.type === 'tool_call') {
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontStyle: 'italic',
                      color: '#8A8A85',
                      padding: '2px 6px',
                      userSelect: 'none',
                    }}
                  >
                    <span>{item.toolDescription}</span>
                  </div>
                );
              }

              if (item.role === 'user') {
                return (
                  <div
                    key={item.id}
                    style={{
                      alignSelf: 'flex-end',
                      maxWidth: '82%',
                      backgroundColor: accentColor,
                      color: buttonTextColor,
                      borderRadius: '14px 14px 2px 14px',
                      padding: '9px 13px',
                      fontSize: '13px',
                      lineHeight: 1.45,
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.content}
                  </div>
                );
              }

              if (item.role === 'system') {
                return (
                  <div
                    key={item.id}
                    style={{
                      alignSelf: 'center',
                      fontSize: '12px',
                      color: '#B91C1C',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid rgba(185, 28, 28, 0.15)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      lineHeight: 1.4,
                      textAlign: 'center',
                    }}
                  >
                    {item.content}
                  </div>
                );
              }

              // Assistant message
              return (
                <div
                  key={item.id}
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: '#FFFFFF',
                    color: '#232320',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '14px 14px 14px 2px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                    wordBreak: 'break-word',
                  }}
                >
                  <div className="assistant-markdown">
                    <ReactMarkdown components={markdownComponents}>
                      {item.content || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#8A8A85',
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: accentColor,
                    animation: 'pulse 1s infinite alternate',
                  }}
                />
                <span>Thinking &amp; guiding...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input & Send Form */}
          <form
            className="guide-input-form"
            onSubmit={handleSend}
            style={{
              padding: '12px 16px',
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              disabled={isLoading}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isLoading ? 'Guide is speaking...' : 'Ask about any part or feature...'}
              style={{
                flex: 1,
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                backgroundColor: isLoading ? '#FAFAF9' : '#FFFFFF',
                color: '#232320',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)')}
            />

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: accentColor,
                color: buttonTextColor,
                fontSize: '13px',
                fontWeight: 500,
                cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease',
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </form>
        </div>
    </>
  );
}

export default GuideChat;
