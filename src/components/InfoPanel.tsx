import { useState, useEffect, useRef } from 'react';
import type { BuildingPart } from '../data/building';

function getContrastTextColor(hexColor: string): string {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  // WCAG relative luminance
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.4 ? '#232320' : '#FAFAF9';
}

export interface InfoPanelProps {
  part: BuildingPart | null;
  isOpen?: boolean;
  isIsolated?: boolean;
  onToggleIsolate?: () => void;
  onClose?: () => void;
  accentColor?: string;
}

export function InfoPanel({
  part: incomingPart,
  isOpen,
  isIsolated = false,
  onToggleIsolate,
  onClose,
  accentColor = '#232320',
}: InfoPanelProps) {
  const effectiveIsOpen = isOpen !== undefined ? isOpen : Boolean(incomingPart);
  const lastPartRef = useRef<BuildingPart | null>(incomingPart);
  if (incomingPart) {
    lastPartRef.current = incomingPart;
  }
  const part = incomingPart || lastPartRef.current;

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState<boolean>(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  // Critically reset AI explanation state whenever selected part changes (keyed on part?.meshName)
  useEffect(() => {
    setAiExplanation(null);
    setIsLoadingExplanation(false);
    setExplanationError(null);
  }, [part?.meshName]);

  if (!part) {
    return null;
  }

  const handleExplain = async () => {
    if (isLoadingExplanation) return;
    setIsLoadingExplanation(true);
    setExplanationError(null);

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: part.displayName,
          romanizedTerm: part.romanizedTerm,
          category: part.category,
          description: part.description,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to fetch architectural explanation';
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch {
          // fallback errorMsg
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data?.explanation) {
        throw new Error('Received empty explanation from server.');
      }

      setAiExplanation(data.explanation);
    } catch (err: any) {
      console.error('[InfoPanel] Explain error:', err);
      setExplanationError(err.message || "Couldn't load explanation, try again");
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const isolateButtonTextColor = getContrastTextColor(accentColor);

  return (
    <div
      className={`info-panel-card ${effectiveIsOpen ? 'panel-open' : 'panel-closed'}`}
      style={{
        position: 'fixed',
        top: '50%',
        right: '24px',
        transform: effectiveIsOpen
          ? 'translateY(-50%) translateX(0)'
          : 'translateY(-50%) translateX(16px)',
        opacity: effectiveIsOpen ? 1 : 0,
        pointerEvents: effectiveIsOpen ? 'auto' : 'none',
        visibility: effectiveIsOpen ? 'visible' : 'hidden',
        transition: 'opacity 180ms ease, transform 180ms ease, visibility 180ms ease',
        maxWidth: '380px',
        width: 'calc(100vw - 48px)',
        borderRadius: '16px',
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
        zIndex: 1000,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        maxHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .info-panel-card {
            top: auto !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
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
            z-index: 1200 !important;
          }
          .info-panel-card.panel-open {
            transform: translateY(0) !important;
          }
          .info-panel-card.panel-closed {
            transform: translateY(16px) !important;
          }
          .info-panel-body {
            padding: 16px 20px 16px 20px !important;
          }
        }
      `}</style>
      {/* Top colored accent bar */}
      <div
        style={{
          height: '3px',
          backgroundColor: accentColor,
          width: '100%',
          flexShrink: 0,
        }}
      />

      {/* Top section: pure white with generous padding, scrolls if content overflows */}
      <div
        className="info-panel-body"
        style={{
          backgroundColor: '#FFFFFF',
          padding: '28px 28px 22px 28px',
          overflowY: 'auto',
          flex: '1 1 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: part.category ? '8px' : '0',
          }}
        >
          {/* Uppercase category label */}
          {part.category ? (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#8A8A85',
              }}
            >
              {part.category}
            </div>
          ) : (
            <div />
          )}

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8A8A85',
                cursor: 'pointer',
                fontSize: '20px',
                lineHeight: 1,
                padding: '0 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#232320')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8A8A85')}
              aria-label="Close panel"
            >
              ×
            </button>
          )}
        </div>

        <h2
          style={{
            margin: '0 0 6px 0',
            fontSize: '19px',
            fontWeight: 600,
            color: '#232320',
            lineHeight: 1.35,
          }}
        >
          {part.displayName}
        </h2>

        {part.romanizedTerm && (
          <p
            style={{
              margin: '0 0 14px 0',
              fontSize: '13px',
              fontStyle: 'italic',
              color: '#8A8A85',
            }}
          >
            {part.romanizedTerm}
          </p>
        )}

        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#232320',
          }}
        >
          {part.description}
        </p>

        {/* AI Explanation Section */}
        {aiExplanation && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#8A8A85',
                marginBottom: '8px',
              }}
            >
              AI EXPLANATION
            </div>
            <div
              style={{
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#232320',
                whiteSpace: 'pre-line',
              }}
            >
              {aiExplanation}
            </div>
          </div>
        )}

        {/* AI Explanation Error Message */}
        {explanationError && (
          <div
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              fontSize: '12px',
              color: '#B91C1C',
              lineHeight: 1.4,
            }}
          >
            {explanationError}
          </div>
        )}
      </div>

      {/* Lower section: pure white with mesh details, category, and isolate action */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '22px 28px 28px 28px',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          flexShrink: 0,
        }}
      >
        {/* Row 1: Mesh reference */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            marginBottom: '10px',
          }}
        >
          <span style={{ color: '#8A8A85' }}>Mesh reference</span>
          <code
            style={{
              color: '#232320',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            {part.meshName}
          </code>
        </div>

        {/* Row 2: Category meta row */}
        {part.category && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              marginBottom: '18px',
            }}
          >
            <span style={{ color: '#8A8A85' }}>Category</span>
            <span
              style={{
                color: '#232320',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {part.category}
            </span>
          </div>
        )}

        {/* Isolate part toggle button */}
        {onToggleIsolate && (
          <button
            type="button"
            onClick={onToggleIsolate}
            style={{
              width: '100%',
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: accentColor,
              color: isolateButtonTextColor,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'opacity 0.15s ease',
              opacity: isIsolated ? 0.88 : 1,
            }}
          >
            {isIsolated ? 'Show all parts' : 'Isolate this part'}
          </button>
        )}

        {/* Explain further AI button */}
        <button
          type="button"
          onClick={handleExplain}
          disabled={isLoadingExplanation}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '9px 14px',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: '8px',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            backgroundColor: '#FFFFFF',
            color: '#232320',
            cursor: isLoadingExplanation ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
            opacity: isLoadingExplanation ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isLoadingExplanation) {
              e.currentTarget.style.backgroundColor = '#FAFAF9';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoadingExplanation) {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)';
            }
          }}
        >
          {isLoadingExplanation ? (
            <>
              {/* Spinner icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              >
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              <span>Explaining...</span>
            </>
          ) : (
            <span>Explain further</span>
          )}
        </button>

        {/* Secondary text link: Clear selection */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              color: '#8A8A85',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
              textAlign: 'center',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#232320')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A8A85')}
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

export default InfoPanel;
