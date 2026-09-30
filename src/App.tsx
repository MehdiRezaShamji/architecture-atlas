import { useState, useEffect } from 'react';
import BuildingViewer from './scene/BuildingViewer';
import InfoPanel from './components/InfoPanel';
import Header from './components/Header';
import SearchAndInfo from './components/SearchAndInfo';
import GuideChat from './components/GuideChat';
import { BuildingMetadata, BuildingRegistryEntry, DEFAULT_ACCENT_COLOR, findMatchingPart } from './data/building';

// Building registry for the "add data, not code" architecture
const BUILDING_REGISTRY: BuildingRegistryEntry[] = [
  {
    id: 'pagoda-prototype-01',
    name: 'Japanese Pagoda (study model)',
    jsonPath: './data/buildings/pagoda.json',
  },
];

// Dynamic building loader map keyed by building id
const BUILDING_LOADERS: Record<string, () => Promise<{ default: BuildingMetadata }>> = {
  'pagoda-prototype-01': () => import('./data/buildings/pagoda.json') as unknown as Promise<{ default: BuildingMetadata }>,
};

function App() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(BUILDING_REGISTRY[0].id);
  const [buildingData, setBuildingData] = useState<BuildingMetadata | null>(null);
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [isIsolated, setIsIsolated] = useState<boolean>(false);
  const [explodeValue, setExplodeValue] = useState<number>(0);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [visibleMeshNames, setVisibleMeshNames] = useState<string[] | null>(null);

  // Load building metadata dynamically whenever selectedBuildingId changes
  useEffect(() => {
    let isCancelled = false;
    const loader = BUILDING_LOADERS[selectedBuildingId];
    if (loader) {
      loader()
        .then((module) => {
          if (!isCancelled) {
            setBuildingData(module.default);
          }
        })
        .catch((err) => {
          console.error(`[App] Failed to dynamically load building ${selectedBuildingId}:`, err);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedBuildingId]);

  const handleSelectBuilding = (newBuildingId: string) => {
    if (newBuildingId === selectedBuildingId) return;
    // Reset all building-specific state that shouldn't persist across buildings
    setSelectedBuildingId(newBuildingId);
    setSelectedMeshName(null);
    setIsIsolated(false);
    setExplodeValue(0);
    setVisibleMeshNames(null);
    setIsGuideOpen(false);
  };

  const handleToggleGuideOpen = () => {
    setIsGuideOpen((prev) => !prev);
  };

  const handleSelectPart = (meshName: string | null) => {
    setSelectedMeshName(meshName);
    if (!meshName) {
      setIsIsolated(false);
      setVisibleMeshNames(null);
    }
  };

  const handleToggleIsolate = () => {
    setIsIsolated((prev) => {
      const next = !prev;
      if (!next) {
        setVisibleMeshNames(null);
      }
      return next;
    });
  };

  const selectedPart = findMatchingPart(buildingData?.parts, selectedMeshName);

  const accentColor = buildingData?.accentColor ?? DEFAULT_ACCENT_COLOR;

  if (!buildingData) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAFAF9',
          color: '#8A8A85',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
        }}
      >
        Loading building study...
      </div>
    );
  }

  return (
    <>
      <Header
        buildings={BUILDING_REGISTRY}
        selectedBuildingId={selectedBuildingId}
        onSelectBuilding={handleSelectBuilding}
      />
      <SearchAndInfo
        key={`search-${selectedBuildingId}`}
        parts={buildingData.parts}
        onSelectPart={handleSelectPart}
        accentColor={accentColor}
        sourceNote={buildingData.sourceNote}
      />
      <BuildingViewer
        key={`viewer-${selectedBuildingId}`}
        buildingData={buildingData}
        selectedMeshName={selectedMeshName}
        onSelectPart={handleSelectPart}
        isIsolated={isIsolated}
        explodeValue={explodeValue}
        onExplodeChange={setExplodeValue}
        visibleMeshNames={visibleMeshNames}
      />
      <InfoPanel
        part={selectedPart}
        isOpen={Boolean(selectedMeshName && !isGuideOpen)}
        isIsolated={isIsolated}
        onToggleIsolate={handleToggleIsolate}
        onClose={() => handleSelectPart(null)}
        accentColor={accentColor}
      />
      <GuideChat
        parts={buildingData.parts}
        onSelectPart={handleSelectPart}
        onToggleIsolate={handleToggleIsolate}
        isIsolated={isIsolated}
        onExplodeChange={setExplodeValue}
        onShowParts={setVisibleMeshNames}
        accentColor={accentColor}
        selectedBuildingId={selectedBuildingId}
        isOpen={isGuideOpen}
        onToggleOpen={handleToggleGuideOpen}
        isInfoPanelOpen={Boolean(selectedMeshName && !isGuideOpen)}
      />
    </>
  );
}

export default App;

