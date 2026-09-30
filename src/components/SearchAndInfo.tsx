import { useState, useRef, useEffect } from 'react';
import type { BuildingPart } from '../data/building';

export interface SearchAndInfoProps {
  parts?: BuildingPart[];
  onSelectPart: (meshName: string) => void;
  accentColor?: string;
  sourceNote?: string;
}

export function SearchAndInfo({
  parts = [],
  onSelectPart,
  accentColor = '#232320',
  sourceNote,
}: SearchAndInfoProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const filteredParts = searchQuery.trim()
    ? parts.filter((p) =>
        p.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .search-and-info-bar {
            top: 92px !important;
            left: 16px !important;
            right: 16px !important;
            width: calc(100vw - 32px) !important;
            max-width: calc(100vw - 32px) !important;
          }
          .search-input-wrapper {
            flex: 1 !important;
            width: 100% !important;
          }
          .search-input-field {
            width: 100% !important;
          }
          .search-dropdown-menu {
            width: 100% !important;
            left: 0 !important;
            right: 0 !important;
          }
          .source-scope-panel {
            top: 12px !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
          }
        }
      `}</style>

      {/* Top-Right Control Bar (stacked row directly below header on mobile) */}
      <div
        ref={containerRef}
        className="search-and-info-bar"
        style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Search input */}
        <div className="search-input-wrapper" style={{ position: 'relative' }}>
          <input
            className="search-input-field"
            type="text"
            value={searchQuery}
            placeholder="Find a part"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) {
                setIsDropdownOpen(true);
              }
            }}
            style={{
              width: '180px',
              height: '36px',
              padding: '0 12px 0 32px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
              fontSize: '13px',
              color: '#232320',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease, width 0.2s ease',
            }}
          />

          {/* Search magnifying glass icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A8A85"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {/* Clear button in input if query present */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(false);
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#8A8A85',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                padding: '2px',
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}

          {/* Live Search Results Dropdown */}
          {isDropdownOpen && searchQuery.trim().length > 0 && (
            <div
              className="search-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '240px',
                maxHeight: '260px',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                zIndex: 1200,
                boxSizing: 'border-box',
              }}
            >
              {filteredParts.length > 0 ? (
                filteredParts.map((part) => (
                  <div
                    key={part.meshName}
                    onClick={() => {
                      onSelectPart(part.meshName);
                      setSearchQuery('');
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#232320' }}>
                      {part.displayName}
                    </div>
                    {part.category && (
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: '#8A8A85',
                          marginTop: '2px',
                        }}
                      >
                        {part.category}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: '12px',
                    fontSize: '12px',
                    color: '#8A8A85',
                    textAlign: 'center',
                  }}
                >
                  No matching parts
                </div>
              )}
            </div>
          )}
        </div>

        {/* Circular "i" Info Button */}
        <button
          type="button"
          onClick={() => setIsSourceOpen((prev) => !prev)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
            color: '#232320',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            transition: 'background-color 0.15s ease',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FAFAF9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }}
          aria-label="Source and Scope Information"
          title="Source & scope"
        >
          i
        </button>
      </div>

      {/* "Source & scope" Slide-in Panel */}
      <div
        className="source-scope-panel"
        style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          bottom: '20px',
          width: '420px',
          maxWidth: 'calc(100vw - 48px)',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
          borderRadius: '16px',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          opacity: isSourceOpen ? 1 : 0,
          transform: isSourceOpen ? 'translateX(0)' : 'translateX(16px)',
          pointerEvents: isSourceOpen ? 'auto' : 'none',
          visibility: isSourceOpen ? 'visible' : 'hidden',
          transition: 'opacity 180ms ease, transform 180ms ease, visibility 180ms ease',
        }}
      >
          {/* Top colored accent bar */}
          <div
            style={{
              height: '3px',
              backgroundColor: accentColor,
              width: '100%',
            }}
          />

          {/* Panel Header */}
          <div
            style={{
              padding: '24px 28px 16px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: '#232320',
              }}
            >
              Source &amp; scope
            </h2>
            <button
              type="button"
              onClick={() => setIsSourceOpen(false)}
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
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#232320')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8A8A85')}
              aria-label="Close panel"
            >
              ×
            </button>
          </div>

          {/* Panel Body */}
          <div
            style={{
              padding: '24px 28px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Site Title & Honest Scope Description */}
            <div>
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#232320',
                }}
              >
                Architecture Atlas
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: '#232320',
                }}
              >
                Architecture Atlas is an interactive 3D study of a single building,
                explored part by part. It provides exploded-view decomposition,
                structural inspection, and architectural nomenclature for educational
                and study purposes.
              </p>
            </div>

            {/* Divider */}
            <div
              style={{
                height: '1px',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
              }}
            />

            {/* Source Section */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#8A8A85',
                  marginBottom: '10px',
                }}
              >
                Source
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: '#232320',
                }}
              >
                Model:{' '}
                <a
                  href="https://sketchfab.com/3d-models/traditional-japanese-pagoda-3d-model-8db99b4d14a44983bccddd9b34d64e81"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: accentColor,
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Traditional Japanese Pagoda 3D Model
                </a>{' '}
                by QuennyTR, via{' '}
                <a
                  href="https://sketchfab.com/3d-models/traditional-japanese-pagoda-3d-model-8db99b4d14a44983bccddd9b34d64e81"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: accentColor,
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Sketchfab
                </a>
                , licensed under CC Attribution 4.0.
              </p>
            </div>

            {/* About this model (sourceNote) */}
            {sourceNote && (
              <>
                <div
                  style={{
                    height: '1px',
                    backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#8A8A85',
                      marginBottom: '8px',
                    }}
                  >
                    About this model
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      lineHeight: 1.6,
                      color: '#232320',
                    }}
                  >
                    {sourceNote}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
    </>
  );
}

export default SearchAndInfo;
