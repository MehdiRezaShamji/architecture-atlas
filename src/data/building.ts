export interface BuildingPart {
  meshName: string;
  displayName: string;
  category: string;
  description: string;
  romanizedTerm?: string;
  note?: string;
}

export const DEFAULT_ACCENT_COLOR = '#232320';

export interface BuildingMetadata {
  id: string;
  name: string;
  modelPath: string;
  modelRotation?: [number, number, number];
  defaultCameraAzimuth?: number;
  accentColor?: string;
  sourceNote?: string;
  parts?: BuildingPart[];
}

export interface BuildingRegistryEntry {
  id: string;
  name: string;
  jsonPath: string;
}

export function findMatchingPart(
  parts?: BuildingPart[],
  meshName?: string | null
): BuildingPart | null {
  if (!parts || !meshName) return null;

  return (
    parts.find((p) => p.meshName === meshName) ||
    parts.find(
      (p) =>
        p.meshName.toLowerCase() === meshName.toLowerCase() ||
        p.meshName.replace(/(_room|_mesh|_geo|_part)$/i, '') ===
          meshName.replace(/(_room|_mesh|_geo|_part)$/i, '') ||
        meshName.startsWith(p.meshName) ||
        p.meshName.startsWith(meshName)
    ) ||
    null
  );
}
