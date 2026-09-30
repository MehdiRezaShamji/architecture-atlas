import type { BuildingRegistryEntry } from '../data/building';

export interface HeaderProps {
  buildings?: BuildingRegistryEntry[];
  selectedBuildingId?: string;
  onSelectBuilding?: (id: string) => void;
}

export function Header({
  buildings = [],
  selectedBuildingId,
  onSelectBuilding,
}: HeaderProps) {
  return (
    <header
      className="app-header"
      style={{
        position: 'fixed',
        top: '20px',
        left: '24px',
        zIndex: 1100,
        pointerEvents: 'none',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .app-header {
            top: 12px !important;
            left: 16px !important;
            right: 16px !important;
            width: calc(100vw - 32px) !important;
            max-width: calc(100vw - 32px) !important;
          }
          .header-eyebrow {
            margin-bottom: 2px !important;
          }
          .header-title {
            font-size: 19px !important;
          }
          .header-picker-wrapper {
            margin-top: 6px !important;
            max-width: 100% !important;
          }
          .header-picker-container {
            max-width: 100% !important;
            display: inline-block !important;
          }
          .header-picker-select {
            max-width: calc(100vw - 40px) !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            font-size: 11.5px !important;
            padding: 5px 26px 5px 8px !important;
          }
        }
      `}</style>

      {/* Eyebrow with status dot marker */}
      <div
        className="header-eyebrow"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#8A8A85',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8A8A85',
          }}
        >
          3D Study
        </span>
      </div>

      {/* Main Title with 3D Pill Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          userSelect: 'none',
        }}
      >
        <h1
          className="header-title"
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            color: '#232320',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Architecture Atlas
        </h1>
        <span
          className="header-badge"
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#8A8A85',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            padding: '1px 6px',
            borderRadius: '10px',
            lineHeight: '14px',
          }}
        >
          3D
        </span>
      </div>

      {/* Building Picker Dropdown */}
      {buildings.length > 0 && (
        <div
          className="header-picker-wrapper"
          style={{
            marginTop: '8px',
            pointerEvents: 'auto',
          }}
        >
          <div
            className="header-picker-container"
            style={{
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <select
              className="header-picker-select"
              value={selectedBuildingId}
              onChange={(e) => onSelectBuilding?.(e.target.value)}
              aria-label="Select building"
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '8px',
                padding: '6px 28px 6px 10px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#232320',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
                cursor: 'pointer',
                outline: 'none',
                lineHeight: 1.4,
              }}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {/* Custom downward chevron indicator */}
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              stroke="#8A8A85"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <polyline points="1 1 5 5 9 1" />
            </svg>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
