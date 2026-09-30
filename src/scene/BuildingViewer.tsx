// NOTE: Confirmation - No rotation logic is hardcoded in BuildingViewer.tsx itself.
// Model rotation is loaded dynamically from the building JSON metadata.

import { useEffect, useState, useRef, useMemo, Suspense, Component, ReactNode } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, Environment } from '@react-three/drei';
import { SafeOrbitControls } from './SafeOrbitControls';
import * as THREE from 'three';
import { BuildingMetadata, DEFAULT_ACCENT_COLOR, findMatchingPart } from '../data/building';

export const FIXED_GAP_UNIT = 0.22;

export interface BuildingViewerProps {
  modelPath?: string;
  buildingData?: BuildingMetadata;
  modelRotation?: [number, number, number];
  selectedMeshName?: string | null;
  onSelectPart?: (partName: string | null) => void;
  isIsolated?: boolean;
  explodeValue?: number;
  onExplodeChange?: (value: number) => void;
  visibleMeshNames?: string[] | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[BuildingViewer] Failed to load 3D model:', error.message);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

function computeFramingDistance(
  box: THREE.Box3,
  camera: THREE.Camera,
  padding: number = 1.35
): number {
  const size = new THREE.Vector3();
  box.getSize(size);
  const persCamera = camera as THREE.PerspectiveCamera;
  const fov = (persCamera.fov * Math.PI) / 180;
  const aspect = persCamera.aspect || window.innerWidth / window.innerHeight;

  const distY = size.y / 2 / Math.tan(fov / 2);
  const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  const maxHorizontalDim = Math.max(size.x, size.z);
  const distX = maxHorizontalDim / 2 / Math.tan(horizontalFov / 2);

  const maxDim = Math.max(size.x, size.y, size.z);
  const distSphere = maxDim / 2 / Math.tan(fov / 2);

  const baseDistance = Math.max(distY, distX, distSphere * 0.9);
  return baseDistance * padding;
}

/**
 * Computes the optimal framing distance and vertically offset center for the entire model,
 * reserving bottom margin so overlay panels (such as the explode slider) do not obscure the model.
 */
function computeModelFraming(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  padding: number = 1.35,
  bottomMarginRatio: number = 0.10
): { framedCenter: THREE.Vector3; distance: number; fov: number } {
  const box = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const persCamera = camera as THREE.PerspectiveCamera;
  const fov = (persCamera.fov * Math.PI) / 180;
  const distance = computeFramingDistance(box, camera, padding);

  // Reserve bottom margin so the overlay panel never overlaps the model:
  // Compute vertical offset as a percentage of viewport height at this camera distance.
  const viewHeightAtDist = 2 * distance * Math.tan(fov / 2);
  const yOffset = viewHeightAtDist * bottomMarginRatio;

  const framedCenter = new THREE.Vector3(center.x, center.y - yOffset, center.z);
  return { framedCenter, distance, fov };
}

function CameraController({
  scene,
  buildingData,
  selectedMeshName,
  controlsRef,
}: {
  scene: THREE.Group | null;
  buildingData?: BuildingMetadata;
  selectedMeshName?: string | null;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const prevSelectedRef = useRef<string | null>(null);
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3());
  const isAnimating = useRef<boolean>(false);
  const hasInitializedCamera = useRef<boolean>(false);

  // Stop camera animation if the user manually manipulates the orbit controls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => {
      isAnimating.current = false;
    };
    controls.addEventListener('start', onStart);
    return () => {
      controls.removeEventListener('start', onStart);
    };
  }, [controlsRef]);

  // Reset initialization flag if scene changes
  useEffect(() => {
    hasInitializedCamera.current = false;
  }, [scene]);

  // Selection auto-framing animation - runs whenever selectedMeshName changes
  useEffect(() => {
    if (!scene) return;

    // Do not animate on initial mount when no selection has occurred
    if (prevSelectedRef.current === null && selectedMeshName === null) {
      return;
    }

    prevSelectedRef.current = selectedMeshName ?? null;
    const controls = controlsRef.current;
    const persCamera = camera as THREE.PerspectiveCamera;
    const fov = (persCamera.fov * Math.PI) / 180;

    if (selectedMeshName) {
      let targetMesh: THREE.Mesh | null = null;
      scene.traverse((node) => {
        if ((node as THREE.Mesh).isMesh && node.name === selectedMeshName) {
          targetMesh = node as THREE.Mesh;
        }
      });

      if (targetMesh) {
        const box = new THREE.Box3().setFromObject(targetMesh);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 0.2);

        let distance = maxDim / 2 / Math.tan(fov / 2);
        distance *= 2.0;
        distance = Math.max(distance, 1.5);

        const currentTarget = controls?.target ?? new THREE.Vector3(0, 0, 0);
        const dir = camera.position.clone().sub(currentTarget).normalize();
        if (dir.lengthSq() < 0.001) dir.set(0.5, 0.5, 1).normalize();

        targetCameraPos.current.copy(center).add(dir.multiplyScalar(distance));
        targetLookAt.current.copy(center);
        isAnimating.current = true;
      }
    } else {
      // Selection cleared -> smoothly animate back to framing the whole model with bottom margin
      const { framedCenter, distance } = computeModelFraming(scene, camera);

      const currentTarget = controls?.target ?? framedCenter;
      const dir = camera.position.clone().sub(currentTarget).normalize();
      if (dir.lengthSq() < 0.001) {
        const azimuthDeg = buildingData?.defaultCameraAzimuth ?? 0;
        const azimuthRad = (azimuthDeg * Math.PI) / 180;
        const elevationRad = (15 * Math.PI) / 180;
        dir.set(
          Math.cos(elevationRad) * Math.sin(azimuthRad),
          Math.sin(elevationRad),
          Math.cos(elevationRad) * Math.cos(azimuthRad)
        ).normalize();
      }

      targetCameraPos.current.copy(framedCenter).add(dir.multiplyScalar(distance));
      targetLookAt.current.copy(framedCenter);
      isAnimating.current = true;
    }
  }, [scene, selectedMeshName, camera, controlsRef, buildingData]);

  useFrame((_, delta) => {
    // Apply initial framing reliably on the first frame where both scene and controls are ready
    if (scene && controlsRef.current && !hasInitializedCamera.current) {
      hasInitializedCamera.current = true;

      const { framedCenter, distance } = computeModelFraming(scene, camera);

      const azimuthDeg = buildingData?.defaultCameraAzimuth ?? 0;
      const azimuthRad = (azimuthDeg * Math.PI) / 180;
      const elevationRad = (15 * Math.PI) / 180;

      const initCamPos = new THREE.Vector3(
        framedCenter.x + distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
        framedCenter.y + distance * Math.sin(elevationRad),
        framedCenter.z + distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
      );

      camera.position.copy(initCamPos);
      controlsRef.current.target.copy(framedCenter);
      controlsRef.current.update();
    }

    if (!isAnimating.current) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const step = 1 - Math.exp(-delta * 5);
    camera.position.lerp(targetCameraPos.current, step);
    controls.target.lerp(targetLookAt.current, step);
    controls.update();

    if (
      camera.position.distanceTo(targetCameraPos.current) < 0.005 &&
      controls.target.distanceTo(targetLookAt.current) < 0.005
    ) {
      camera.position.copy(targetCameraPos.current);
      controls.target.copy(targetLookAt.current);
      controls.update();
      isAnimating.current = false;
    }
  });

  return null;
}

function ModelContent({
  modelPath,
  modelRotation = [0, 0, 0],
  buildingData,
  selectedMeshName = null,
  onSelectMesh,
  explodeValue = 0,
  isIsolated = false,
  onHoverPart,
  controlsRef,
  isGenuineClick,
  visibleMeshNames,
  onLoaded,
}: {
  modelPath: string;
  modelRotation?: [number, number, number];
  buildingData?: BuildingMetadata;
  selectedMeshName?: string | null;
  onSelectMesh: (meshName: string | null) => void;
  explodeValue?: number;
  isIsolated?: boolean;
  onHoverPart: (part: { displayName: string; x: number; y: number } | null) => void;
  controlsRef: React.RefObject<any>;
  isGenuineClick: (e: { clientX: number; clientY: number; shiftKey?: boolean }) => boolean;
  visibleMeshNames?: string[] | null;
  onLoaded?: () => void;
}) {
  const { scene } = useGLTF(modelPath);

  useEffect(() => {
    if (scene) {
      onLoaded?.();
    }
  }, [scene, onLoaded]);

  // Single canonical THREE.Euler representation of modelRotation, used both for explode vector transformation and group rotation
  const rotationEuler = useMemo(
    () => new THREE.Euler(modelRotation[0], modelRotation[1], modelRotation[2], 'XYZ'),
    [modelRotation[0], modelRotation[1], modelRotation[2]]
  );

  // Clone material per-mesh on scene load so original loaded materials are never mutated directly,
  // and compute explode offsets transformed by modelRotation so world separation direction is preserved.
  useEffect(() => {
    if (!scene) return;

    const meshes: THREE.Mesh[] = [];
    let overallMinY = Infinity;
    let overallMaxY = -Infinity;

    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => mat.clone());
          } else {
            mesh.material = mesh.material.clone();
          }
        }

        // Store original position (clone it)
        mesh.userData.originalPosition = mesh.position.clone();

        // Compute vertical bounding-box center (average of local min/max Y)
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        const box = mesh.geometry.boundingBox;
        if (box) {
          const meshMinY = box.min.y;
          const meshMaxY = box.max.y;
          const meshVerticalCenter = (meshMinY + meshMaxY) / 2;
          mesh.userData.meshVerticalCenter = meshVerticalCenter;

          overallMinY = Math.min(overallMinY, meshMinY);
          overallMaxY = Math.max(overallMaxY, meshMaxY);
        }

        meshes.push(mesh);
      }
    });

    // Sort meshes by vertical center ascending (bottom to top)
    const sortedMeshes = [...meshes].sort((a, b) => {
      const aCenter = (a.userData.meshVerticalCenter as number) ?? 0;
      const bCenter = (b.userData.meshVerticalCenter as number) ?? 0;
      return aCenter - bCenter;
    });

    // Assign rank index (0 for lowest, increasing upward).
    // If two meshes have nearly identical vertical centers (within EPSILON), they share the same rank.
    const EPSILON = 0.01;
    let currentRank = 0;
    for (let i = 0; i < sortedMeshes.length; i++) {
      if (i > 0) {
        const prevCenter = (sortedMeshes[i - 1].userData.meshVerticalCenter as number) ?? 0;
        const curCenter = (sortedMeshes[i].userData.meshVerticalCenter as number) ?? 0;
        if (Math.abs(curCenter - prevCenter) > EPSILON) {
          currentRank++;
        }
      }
      sortedMeshes[i].userData.meshRank = currentRank;
    }

    const minRank = sortedMeshes.length > 0 ? (sortedMeshes[0].userData.meshRank as number) : 0;
    const maxRank =
      sortedMeshes.length > 0
        ? (sortedMeshes[sortedMeshes.length - 1].userData.meshRank as number)
        : 0;
    const middleRank = (minRank + maxRank) / 2;

    for (const mesh of meshes) {
      const rank = (mesh.userData.meshRank as number) ?? 0;
      const rawExplodeOffset = (rank - middleRank) * FIXED_GAP_UNIT;

      // Transform the vertical explode offset vector using the single rotationEuler instance
      const offsetVec = new THREE.Vector3(0, rawExplodeOffset, 0);
      offsetVec.applyEuler(rotationEuler);

      mesh.userData.explodeOffset = offsetVec.y;

      // Apply initial explode position if explodeValue is already set
      const origPos = mesh.userData.originalPosition as THREE.Vector3 | undefined;
      if (origPos) {
        mesh.position.y = origPos.y + offsetVec.y * explodeValue;
      }
    }

    if (import.meta.env.DEV) {
      const traverseHierarchy = (node: THREE.Object3D, depth: number = 0) => {
        const indent = '  '.repeat(depth);
        const name = node.name || '(unnamed)';
        const type = node.type ? node.type.toLowerCase() : 'object3d';
        console.log(`${indent}${name} (${type}) [uuid: ${node.uuid}]`);

        node.children.forEach((child) => {
          traverseHierarchy(child, depth + 1);
        });
      };

      console.log(`[BuildingViewer] Scene Graph for ${modelPath}:`);
      console.log(`[BuildingViewer] Dynamic modelRotation applied from JSON metadata:`, modelRotation);
      traverseHierarchy(scene, 0);
    }
  }, [scene, modelPath, rotationEuler]);

  // Update vertical position on slider change: mesh.position.y = originalPosition.y + explodeOffset * sliderValue
  useEffect(() => {
    if (!scene) return;

    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const originalPos = mesh.userData.originalPosition as THREE.Vector3 | undefined;
        const explodeOffset = mesh.userData.explodeOffset as number | undefined;

        if (originalPos && typeof explodeOffset === 'number') {
          mesh.position.y = originalPos.y + explodeOffset * explodeValue;
        }
      }
    });
  }, [scene, explodeValue]);

  // Handle part visibility: supports distinct visibleMeshNames mode (showParts tool) alongside single-part isolation
  useEffect(() => {
    if (!scene) return;

    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (visibleMeshNames && Array.isArray(visibleMeshNames)) {
          // Group visibility mode (showParts): only meshes in the list are visible
          mesh.visible = visibleMeshNames.includes(mesh.name);
        } else if (isIsolated && selectedMeshName) {
          // Single-part isolation mode
          mesh.visible = mesh.name === selectedMeshName;
        } else {
          // Normal mode: all meshes visible
          mesh.visible = true;
        }
      }
    });
  }, [scene, isIsolated, selectedMeshName, visibleMeshNames]);

  // Apply emissive highlight to selected mesh material only during normal selection (never during isolate mode)
  // The building has a real gold-colored part (Golden_trim_band), so the highlight must never be a warm/gold tone that could be confused with actual material color.
  useEffect(() => {
    if (!scene) return;

    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const isSelected = !isIsolated && selectedMeshName !== null && mesh.name === selectedMeshName;

        materials.forEach((mat) => {
          if ('emissive' in mat && (mat as THREE.MeshStandardMaterial).emissive) {
            const standardMat = mat as THREE.MeshStandardMaterial;
            if (isSelected) {
              standardMat.emissive.set('#7EA8C9');
              standardMat.emissiveIntensity = 0.45;
            } else {
              standardMat.emissive.set('#000000');
              standardMat.emissiveIntensity = 0;
            }
          }
        });
      }
    });
  }, [scene, selectedMeshName, isIsolated]);

  const getDisplayName = (object: THREE.Object3D): string | null => {
    const name = object.name || object.parent?.name || null;
    return findMatchingPart(buildingData?.parts, name)?.displayName || null;
  };

  return (
    <>
      <primitive
        object={scene}
        rotation={rotationEuler}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const nativeEvent = e.nativeEvent || e;
          if (!isGenuineClick(nativeEvent)) {
            return;
          }
          const clickedMesh = e.object as THREE.Mesh;
          const vertexCount = clickedMesh.geometry?.attributes?.position?.count ?? 0;
          if (import.meta.env.DEV) {
            console.log(
              `[BuildingViewer] Mesh Clicked -> Name: "${clickedMesh.name}", UUID: ${clickedMesh.uuid}, Vertices: ${vertexCount}`
            );
          }
          const name = clickedMesh.name || clickedMesh.parent?.name || null;
          onSelectMesh(name);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const displayName = getDisplayName(e.object);
          if (displayName) {
            onHoverPart({
              displayName,
              x: e.clientX,
              y: e.clientY,
            });
          }
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const displayName = getDisplayName(e.object);
          if (displayName) {
            onHoverPart({
              displayName,
              x: e.clientX,
              y: e.clientY,
            });
          }
        }}
        onPointerOut={() => {
          onHoverPart(null);
        }}
      />
      <CameraController
        scene={scene}
        buildingData={buildingData}
        selectedMeshName={selectedMeshName}
        controlsRef={controlsRef}
      />
    </>
  );
}

export function BuildingViewer({
  modelPath,
  buildingData,
  modelRotation,
  selectedMeshName = null,
  onSelectPart,
  isIsolated = false,
  explodeValue: controlledExplodeValue,
  onExplodeChange,
  visibleMeshNames,
}: BuildingViewerProps) {
  const [internalExplodeValue, setInternalExplodeValue] = useState<number>(0);
  const isControlled = controlledExplodeValue !== undefined;
  const effectiveExplodeValue = isControlled ? controlledExplodeValue : internalExplodeValue;

  const handleExplodeChange = (newValue: number) => {
    if (!isControlled) {
      setInternalExplodeValue(newValue);
    }
    onExplodeChange?.(newValue);
  };

  const [hoveredPart, setHoveredPart] = useState<{
    displayName: string;
    x: number;
    y: number;
  } | null>(null);
  const controlsRef = useRef<any>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number; shiftKey: boolean } | null>(null);

  const effectiveModelPath = modelPath || buildingData?.modelPath || '/models/pagoda_segmented.glb';
  const effectiveRotation: [number, number, number] =
    modelRotation || buildingData?.modelRotation || [0, 0, 0];
  const effectiveAccentColor = buildingData?.accentColor ?? DEFAULT_ACCENT_COLOR;

  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);

  // Reset loading indicator whenever effectiveModelPath changes (e.g. building switch)
  useEffect(() => {
    setIsModelLoading(true);
  }, [effectiveModelPath]);

  const handleSelectMesh = (meshName: string | null) => {
    if (import.meta.env.DEV) {
      console.log('[BuildingViewer] Selected mesh:', meshName);
    }
    if (onSelectPart) {
      onSelectPart(meshName);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // If a secondary touch occurs (e.g. 2nd finger for pinch-to-zoom), clear tap detection
    if (e.pointerType === 'touch' && !e.isPrimary) {
      pointerDownPosRef.current = null;
      return;
    }
    pointerDownPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      shiftKey: e.shiftKey,
    };
  };

  const isGenuineClick = (e: { clientX: number; clientY: number; shiftKey?: boolean }): boolean => {
    if (!pointerDownPosRef.current) {
      return false;
    }
    // If Shift key was held at pointer-down or pointer-up (drag-to-pan), do not treat as selection click
    if (e.shiftKey || pointerDownPosRef.current.shiftKey) {
      return false;
    }
    // Only treat as click if pointer moved <= 5px between pointer-down and pointer-up
    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;
    return dx * dx + dy * dy <= 25;
  };

  return (
    <div
      className="building-viewer-root"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
        overflow: 'hidden',
        background: '#FAFAF9',
      }}
      onPointerLeave={() => setHoveredPart(null)}
    >
      <style>{`
        .building-viewer-root {
          width: 100vw;
          height: 100vh;
          height: 100dvh;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Loading state for initial model fetch or building switch */}
      {isModelLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FAFAF9',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '2px solid rgba(0, 0, 0, 0.08)',
              borderTopColor: effectiveAccentColor,
              animation: 'spin 0.8s linear infinite',
              marginBottom: '12px',
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#8A8A85',
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '0.01em',
            }}
          >
            Loading model...
          </span>
        </div>
      )}

      <Canvas
        onPointerDown={handlePointerDown}
        onPointerMissed={(e: MouseEvent) => {
          if (isGenuineClick(e)) {
            handleSelectMesh(null);
          }
        }}
        camera={{ fov: 50 }}
        style={{ width: '100%', height: '100%', background: '#FAFAF9' }}
      >
        <color attach="background" args={['#FAFAF9']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <directionalLight position={[-10, -10, -5]} intensity={1.0} />
        <Environment preset="city" />

        <ModelErrorBoundary
          key={effectiveModelPath}
          fallback={(err) => (
            <Html center>
              <div
                style={{
                  color: '#ef4444',
                  background: '#1f2937',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #374151',
                  textAlign: 'center',
                  fontFamily: 'sans-serif',
                }}
              >
                <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>Error Loading Model</p>
                <p style={{ fontSize: '12px', margin: 0, color: '#9ca3af' }}>{err.message}</p>
              </div>
            </Html>
          )}
        >
          <Suspense fallback={null}>
            <ModelContent
              modelPath={effectiveModelPath}
              modelRotation={effectiveRotation}
              buildingData={buildingData}
              selectedMeshName={selectedMeshName}
              onSelectMesh={handleSelectMesh}
              explodeValue={effectiveExplodeValue}
              isIsolated={isIsolated}
              onHoverPart={setHoveredPart}
              controlsRef={controlsRef}
              isGenuineClick={isGenuineClick}
              visibleMeshNames={visibleMeshNames}
              onLoaded={() => setIsModelLoading(false)}
            />
          </Suspense>
        </ModelErrorBoundary>

        <SafeOrbitControls ref={controlsRef} makeDefault />
      </Canvas>

      {/* Floating Hover Tooltip */}
      {hoveredPart && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredPart.x + 14}px`,
            top: `${hoveredPart.y + 14}px`,
            pointerEvents: 'none',
            zIndex: 2000,
            backgroundColor: '#FFFFFF',
            color: '#232320',
            padding: '5px 11px',
            borderRadius: '6px',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {hoveredPart.displayName}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .explode-slider-container {
            position: fixed !important;
            bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
            max-width: calc(100vw - 32px) !important;
            transform: none !important;
            border-radius: 12px !important;
            padding: 8px 16px !important;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08) !important;
          }
          .explode-slider-container.isolated {
            position: fixed !important;
            bottom: 0 !important;
            bottom: env(safe-area-inset-bottom, 0px) !important;
            left: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
            padding: 10px 20px calc(10px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .explode-slider-input {
            width: 100% !important;
          }
          .usage-hint-text {
            position: fixed !important;
            bottom: calc(68px + env(safe-area-inset-bottom, 0px)) !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            text-align: center !important;
            display: flex !important;
            justify-content: center !important;
          }
          .usage-hint-text.isolated {
            bottom: calc(58px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .desktop-hint {
            display: none !important;
          }
          .mobile-hint {
            display: inline !important;
          }
        }
        @media (min-width: 641px) {
          .desktop-hint {
            display: inline !important;
          }
          .mobile-hint {
            display: none !important;
          }
        }
        @media (max-width: 360px) {
          .usage-hint-text {
            display: none !important;
          }
        }
      `}</style>

      {/* Explode View Slider Overlay (Compact centered by default, expands to full-width in isolate mode) */}
      <div
        className={`explode-slider-container ${isIsolated ? 'isolated' : ''}`}
        style={{
          position: 'absolute',
          bottom: isIsolated ? '0' : '24px',
          left: isIsolated ? '0' : '50%',
          transform: isIsolated ? 'none' : 'translateX(-50%)',
          width: isIsolated ? '100vw' : 'auto',
          boxSizing: 'border-box',
          zIndex: 10,
          background: '#FFFFFF',
          border: isIsolated ? 'none' : '1px solid rgba(0, 0, 0, 0.08)',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: isIsolated ? '0px' : '10px',
          padding: isIsolated ? '12px 32px' : '6px 16px',
          display: 'flex',
          flexDirection: isIsolated ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isIsolated ? 'center' : 'center',
          gap: isIsolated ? '24px' : '4px',
          boxShadow: isIsolated
            ? '0 -2px 12px rgba(0, 0, 0, 0.04)'
            : '0 2px 12px rgba(0, 0, 0, 0.06)',
          color: '#232320',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          userSelect: 'none',
          transition:
            'bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease, padding 0.25s ease',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: isIsolated ? 'auto' : '100%',
            fontSize: '12px',
            fontWeight: 500,
            color: '#8A8A85',
          }}
        >
          <span style={{ color: '#232320', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Assembled ↔ Exploded
          </span>
          <span
            style={{
              color: '#232320',
              fontFamily: 'monospace',
              fontWeight: 600,
              marginLeft: isIsolated ? '10px' : '16px',
            }}
          >
            {Math.round(effectiveExplodeValue * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effectiveExplodeValue}
          onChange={(e) => handleExplodeChange(parseFloat(e.target.value))}
          className="explode-slider-input"
          style={{
            width: isIsolated ? 'min(420px, 45vw)' : '220px',
            height: '4px',
            cursor: 'pointer',
            accentColor: effectiveAccentColor,
            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          aria-label="Assembled ↔ Exploded"
        />
      </div>

      {/* Usage hint line */}
      <div
        className={`usage-hint-text ${isIsolated ? 'isolated' : ''}`}
        style={{
          position: 'absolute',
          bottom: isIsolated ? '56px' : '16px',
          left: '24px',
          zIndex: 5,
          color: '#8A8A85',
          fontSize: '11px',
          fontWeight: 500,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          transition: 'bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span className="desktop-hint">
          Drag to orbit · Scroll to zoom · Shift + drag to pan · Click a part to inspect
        </span>
        <span className="mobile-hint">
          Tap a part to inspect
        </span>
      </div>
    </div>
  );
}

export default BuildingViewer;
