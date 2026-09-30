# Architecture Atlas — Full Project Audit

*Generated as part of design system consolidation and codebase review.*

---

## 1. Source File Inventory & Responsibilities

All source files located under `/src`, organized by directory:

### `/src` (Root)
* **`App.tsx`**: Top-level application coordinator that maintains selection (`selectedMeshName`) and view mode (`isIsolated`) state, resolves active part metadata, and renders the layout overlays (`Header`, `SearchAndInfo`, `InfoPanel`) alongside `BuildingViewer`.
* **`main.tsx`**: Client entry point that bootstraps the React application and mounts `<App />` into the DOM `#root` node within `React.StrictMode`.
* **`vite-env.d.ts`**: TypeScript declaration file providing ambient type definitions for Vite client features and environment variables.

### `/src/ai`
* **`.gitkeep`**: Empty marker file reserving the directory for planned AI integration features.

### `/src/components`
* **`.gitkeep`**: Directory tracking marker.
* **`Header.tsx`**: Fixed top-left site header displaying an uppercase `"3D STUDY"` label with a status dot marker, the primary `"Architecture Atlas"` title, and a `"3D"` pill badge.
* **`InfoPanel.tsx`**: Fixed right-side metadata card presenting the active part's architectural hierarchy, category, romanized terminology, description, and mesh reference, along with isolate-mode and clear-selection actions.
* **`SearchAndInfo.tsx`**: Fixed top-right utility toolbar containing an interactive search input with a live dropdown to search/select parts by name, and an info (`"i"`) button that toggles a slide-in `"Source & scope"` drawer with attribution notices.

### `/src/data`
* **`.gitkeep`**: Directory tracking marker.
* **`building.ts`**: Core TypeScript data contracts defining the schemas for segmented architectural parts (`BuildingPart`) and building metadata (`BuildingMetadata`).
* **`pagoda.json`**: *Legacy prototype stub* containing minimal building metadata (`id`, `name`, `modelPath`, `modelRotation`) created prior to full mesh segmentation. (See Section 3).

### `/src/data/buildings`
* **`pagoda.json`**: Active canonical metadata definition for the Japanese Pagoda study model, specifying model transform, default camera azimuth (`337`), theme accent color (`#7A2E2E`), and the full segmented parts catalogue.

### `/src/scene`
* **`BuildingViewer.tsx`**: Main 3D canvas component utilizing React Three Fiber and Drei. Handles GLTF loading, material instantiation, OrbitControls integration, camera auto-framing animations (`CameraController`), vertical explosion offsets (`ModelContent`), emissive highlighting, and the explode view range slider overlay.

---

## 2. Component State & Prop Breakdown

### `App.tsx`
* **Props**: None (root component).
* **State**:
  * `selectedMeshName: string | null`: The single source of truth tracking which building mesh is currently selected; set via 3D click, search selection, or cleared via close actions.
  * `isIsolated: boolean`: Tracks whether the view is currently isolating the selected mesh (hiding all other meshes) or showing the complete building.
* **Derived Variables**:
  * `selectedPart: BuildingPart | null`: Resolves the matching part definition from `pagodaData.parts` using `selectedMeshName`.
  * `accentColor: string`: Resolves `pagodaData.accentColor` with a fallback to `#232320`.

### `BuildingViewer.tsx`

#### `BuildingViewerProps` (Component Props)
* `modelPath?: string`: Optional GLB model path override (falls back to `buildingData.modelPath` or default path).
* `buildingData?: BuildingMetadata`: Building metadata providing model paths, transform rotations, camera azimuth, accent color, and part definitions.
* `modelRotation?: [number, number, number]`: Optional Euler group rotation override applied to the loaded 3D scene.
* `selectedMeshName?: string | null`: Fully controlled prop specifying the active mesh to drive camera framing and emissive highlighting.
* `onSelectPart?: (partName: string | null) => void`: Event callback invoked when a mesh is selected or deselected in the 3D viewport.
* `isIsolated?: boolean`: Flag determining if unselected parts are hidden and triggering the full-width bottom slider layout.

#### `BuildingViewer` Internal State & Refs
* `explodeValue: number`: Local state (0 to 1) tracking the slider progress for exploding building meshes vertically.
* `hoveredPart: { displayName: string; x: number; y: number } | null`: Local state tracking the display name and viewport coordinates of the mesh currently under the pointer.
* `controlsRef: React.RefObject<any>`: Ref to Drei `OrbitControls` to coordinate camera targets and user interaction listeners.
* `pointerDownPosRef: React.RefObject<{ x, y, shiftKey } | null>`: Ref capturing pointer-down coordinates and Shift-key state to differentiate orbit/pan drags from selection clicks.

#### `CameraController` Props & Internal State
* `scene: THREE.Group | null` (Prop): Loaded Three.js scene graph used to calculate mesh bounding boxes and centers.
* `buildingData?: BuildingMetadata` (Prop): Used to read `defaultCameraAzimuth` during initial and reset camera positioning.
* `selectedMeshName?: string | null` (Prop): Target mesh driving selection framing animations.
* `controlsRef: React.RefObject<any>` (Prop): Reference to OrbitControls to animate target look-at coordinates.
* `prevSelectedRef: useRef<string | null>`: Tracks previous selection state to prevent spurious animations on initial mount.
* `targetCameraPos: useRef<THREE.Vector3>`: Target destination camera vector for smooth interpolation.
* `targetLookAt: useRef<THREE.Vector3>`: Target look-at center vector for smooth interpolation.
* `isAnimating: useRef<boolean>`: Flag indicating whether camera position/target is actively in smooth lerp transition.
* `hasInitializedCamera: useRef<boolean>`: Ensures initial camera distance and azimuth framing run once per scene load.

#### `ModelContent` Props
* `modelPath: string`: GLTF model URI to load via `useGLTF`.
* `modelRotation?: [number, number, number]`: Group rotation applied to `<primitive object={scene} />`.
* `buildingData?: BuildingMetadata`: Metadata used to resolve part display names for hover events.
* `selectedMeshName?: string | null`: Mesh identifier driving material emissive highlight and isolation visibility.
* `onSelectMesh: (meshName: string | null) => void`: Callback reporting mesh click selections to `BuildingViewer`.
* `explodeValue?: number`: Current vertical offset ratio applied to mesh Y positions.
* `isIsolated?: boolean`: Toggles visibility of non-selected meshes.
* `onHoverPart: (...) => void`: Emits hover tooltip coordinates and names to parent state.
* `controlsRef: React.RefObject<any>`: Forwarded to `CameraController`.
* `isGenuineClick: (...) => boolean`: Evaluates whether a mouse-up event qualifies as a selection click or an orbit drag.

---

## 3. Dead Code & Unreferenced Artifacts

1. **Unreferenced File — `src/data/pagoda.json`**:
   * An outdated 7-line stub file (`id: "pagoda"`). The active app exclusively imports `src/data/buildings/pagoda.json`. This file is completely unreferenced.
2. **Unused Metadata Schema Fields**:
   * `BuildingMetadata.sourceNote`: Defined in `building.ts` and present in `src/data/buildings/pagoda.json`, but never rendered or read by any component.
   * `BuildingPart.note`: Defined in `building.ts` and present on multiple entries in `pagoda.json`, but never displayed in `InfoPanel` or tooltips.
3. **Debug Console Logging in Scene Traversal (`BuildingViewer.tsx`)**:
   * Lines 340–355 in `BuildingViewer.tsx` define and run `traverseHierarchy(scene, 0)` which logs the full scene hierarchy and UUIDs to the browser console on every model load.
4. **Redundant Fallback Model Path (`BuildingViewer.tsx`)**:
   * Line 502 defines `effectiveModelPath = modelPath || buildingData?.modelPath || '/models/pagoda_segmented.glb'`. The default points to `pagoda_segmented.glb`, whereas `pagoda.json` uses `/models/pagoda.glb`.

---

## 4. Information Duplication & Redundant Computation

1. **Duplicate Building JSON Files**:
   * `src/data/pagoda.json` and `src/data/buildings/pagoda.json` both define pagoda configuration independently.
2. **Dual Accent Color Fallback Logic**:
   * Both `App.tsx` (`pagodaData.accentColor ?? '#232320'`) and `BuildingViewer.tsx` (`buildingData?.accentColor ?? '#232320'`) independently declare the default fallback color `#232320`.
3. **Duplicate Framing Distance & Offset Calculation (`BuildingViewer.tsx`)**:
   * In `CameraController`, the logic calculating whole-model framing distance (`computeFramingDistance`) and the 10% bottom-margin view height offset (`viewHeightAtDist * bottomMarginRatio`) is written twice:
     * Once in `useFrame` for initial scene framing.
     * Once in `useEffect` when selection is cleared (`selectedMeshName === null`).
4. **Duplicate Euler Rotation Instantiation (`BuildingViewer.tsx`)**:
   * In `ModelContent`, `modelRotation` is passed to `<primitive rotation={modelRotation} />`, but also re-instantiated via `new THREE.Euler(modelRotation[0], modelRotation[1], modelRotation[2], 'XYZ')` inside the material cloning effect to transform explode vectors.

---

## 5. Catalog of Code Comments (`TEMP`, `TODO`, `FIXME`, `DEBUG`)

### Project Source Code Comments
* **`src/scene/BuildingViewer.tsx` (Lines 226, 630)**:
  * *Cleaned up in Task 1*: The temporary azimuth-calibration overlay and its live readout effect were removed. (No remaining `TEMP` comments in `BuildingViewer.tsx`).

### Metadata Notes Containing Keyword References
* **`src/data/buildings/pagoda.json` (Line 47)**:
  ```json
  "note": "This mesh covers the ground-floor railing only. The first-floor level still has its railing merged into First_floor_room (tracked in TODO, not yet split out) - do not describe this mesh as covering the whole building's railings."
  ```
* **`src/data/buildings/pagoda.json` (Line 92)**:
  ```json
  "note": "Intentional honest catch-all, not a segmentation error. Kept rather than deleted because removing it would leave visible holes in the model. Flagged in TODO.md for future consolidation into fewer, better-organized pieces."
  ```

*(Note: Third-party dependencies inside `node_modules` and compiled lockfiles contain internal vendor comments, but no other `TODO`/`TEMP`/`FIXME`/`DEBUG` comments exist in the application source code.)*
