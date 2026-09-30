# Architecture Atlas

An interactive 3D architectural study application that decomposes structures into annotated, inspectable assemblies.

Live Demo: https://architecture-atlas-opal.vercel.app

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r174-black?logo=three.js)](https://threejs.org/)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)](https://vercel.com/)

---

## Features

- **Interactive 3D Assembly**: Orbit, pan, and zoom controls built on Three.js and `@react-three/fiber` with custom pointer and touch-gesture disambiguation (handling desktop mouse navigation, shift-pan, and mobile two-finger pinch-zoom).
- **Click and Tap Inspection**: Select any discrete mesh component via 3D raycasting or dropdown search to reveal its architectural nomenclature, category, and functional description.
- **Exploded View Decomposition**: Continuous slider separates components strictly along the vertical axis (model-local Y, oriented by model rotation). Spacing is calculated from geometry bounding-box vertical centers: parts are sorted bottom-to-top, grouped into rank indices (parts sharing centers within 0.01 receive the same rank), and offset from the median rank by `(rank - middleRank) * 0.22`, scaled linearly by the slider value (0 to 1).
- **Part Isolation**: Isolate individual components or specific assemblies against a neutral background, dimming or hiding surrounding structural geometry.
- **Real-Time Search**: Search input filters parts in real time by display name with direct camera selection focus; transliterated Japanese terminology (e.g., *kidan*, *sōrin*, *engawa*, *kōran*) and functional categories from `pagoda.json` are displayed in the dropdown menu and the side Info Panel.
- **Per-Part AI Explanation**: Serverless endpoint querying Groq to generate grounded, 2–4 paragraph contextual architectural explanations for selected parts.
- **Conversational 3D AI Guide**: Multi-turn chat assistant that controls the 3D canvas via function/tool calling (highlighting parts, isolating assemblies, adjusting explode percentage, or resetting the scene) while explaining design concepts.

---

## Architecture

The core design principle of Architecture Atlas is a data-driven rendering pipeline: **one generic `BuildingViewer` handles 3D rendering, animations, materials, raycasting, and camera manipulation entirely from JSON metadata**. Adding a new structure requires authoring a building definition file—no rendering code or 3D scene logic is modified.

### Key Decisions

1. **Add Data, Not Code**: Adding a new building requires placing a segmented 3D model (`.glb`) in `public/models/` and defining its structural metadata in `src/data/buildings/<building-id>.json` (specifying part mesh names, display names, categories, descriptions, camera azimuth, model rotation, and accent color). The generic `BuildingViewer` handles rendering, raycasting, and animations without modifying any rendering or scene logic.
2. **Fixed Neutral UI with Per-Building Accent**: The UI maintains a clean architectural neutral chrome (`#FAFAF9` canvas, `#FFFFFF` panels, `#232320` typography) accented by a single configurable `accentColor` (e.g., `#7A2E2E` vermilion lacquer for the pagoda) derived from the building metadata.
3. **Responsive Viewport Handling**: UI elements use dynamic viewport units (`dvh` with `vh` fallback) and CSS `env(safe-area-inset-*)` rules to ensure that panels and controls remain accessible across desktop and mobile devices without obscuring the 3D model.

### Directory Structure

```text
architecture-atlas/
├── api/
│   ├── explain.ts              # Serverless Groq handler for part-level architectural explanations
│   └── guide.ts                # Serverless Groq handler for the tool-calling AI tour guide
├── public/
│   └── models/
│       └── pagoda.glb          # Segmented 3D building asset
├── scripts/
│   ├── generate_pagoda.js      # Procedural geometry generation script
│   └── inspect-model.js        # GLTF mesh analysis and anomaly detection utility
├── src/
│   ├── components/
│   │   ├── GuideChat.tsx       # AI Guide drawer, tool execution loop, Markdown message renderer
│   │   ├── Header.tsx          # Minimal header and building switcher
│   │   ├── InfoPanel.tsx       # Metadata side sheet with AI explanation trigger and isolate controls
│   │   └── SearchAndInfo.tsx   # Live component search, scope modal, model attribution
│   ├── data/
│   │   ├── buildings/
│   │   │   └── pagoda.json     # Structural hierarchy, mesh names, terms, accent color
│   │   └── building.ts         # TypeScript interfaces and matching utilities
│   ├── scene/
│   │   ├── BuildingViewer.tsx  # Canvas, explode interpolation, selection raycaster, hover tooltips
│   │   └── SafeOrbitControls.tsx # OrbitControls wrapper with touch and pointer stabilization
│   ├── App.tsx                 # Root layout and application state coordination
│   └── main.tsx                # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## How the AI Guide Works

The "Ask AI Guide" feature integrates an interactive conversational assistant directly into the 3D scene using Groq:

1. **System Prompt & Grounding**: When a user submits a query, `api/guide.ts` injects the complete manifest of valid building parts (`displayName` and `meshName`) into the system prompt. The model is instructed to only interact with genuine parts listed in the manifest and to prioritize spatial demonstrations over pure text.
2. **Tool Calling**: The serverless function exposes six discrete tool definitions to the LLM:
   - `highlightPart(meshName)`: Selects and highlights a component in the 3D viewport.
   - `isolatePart(meshName)`: Enters isolation mode focused on a specific component.
   - `showParts(meshNames)`: Displays a specific subset of parts simultaneously (e.g., all roof tiers) while hiding the remainder.
   - `clearIsolation()`: Exits isolation mode to display the entire building assembly.
   - `setExplodeAmount(percent)`: Adjusts the explode slider between 0% and 100%.
   - `clearSelection()`: Clears active selections and resets explode and isolation states.
3. **Execution Loop & Safety Limits**: Client-side execution in `GuideChat.tsx` manages a multi-turn tool-calling loop:
   - The client invokes `/api/guide` with current conversation history and part summaries.
   - If the model returns tool calls, the frontend executes the scene transformations immediately, appends tool execution result messages to the conversation state, and calls `/api/guide` again.
   - The loop continues until the model produces a final user-facing text response or reaches a hard safety cap of **5 tool-call rounds per turn**.
4. **Model Configuration**:
   - Both `/api/guide` and `/api/explain` query Groq's API specifying `openai/gpt-oss-120b`.

---

## Tech Stack

- **Frontend Core**: React 18, TypeScript, Vite
- **3D Graphics**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **Markdown Rendering**: `react-markdown`
- **Serverless API**: Vercel Serverless Functions (`/api`)
- **LLM Inference**: Groq Cloud API (`openai/gpt-oss-120b`)

---

## Running Locally

### Prerequisites

- Node.js 18+
- npm
- Groq API Key (for AI Guide and Explain features)

### Installation

```bash
# Clone the repository
git clone https://github.com/MehdiRezaShamji/architecture-atlas.git
cd architecture-atlas

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root:

```bash
GROQ_API_KEY=your_groq_api_key_here
```

> Note: Never commit `.env.local` or expose your `GROQ_API_KEY` in client-side code or public version control. It is excluded via `.gitignore`.

### Development Server

1. **Client-Only Mode** (3D Viewer and UI without AI endpoints):

   ```bash
   npm run dev
   ```

2. **Full Stack with Serverless Functions** (Recommended):

   Because the AI Guide and part explanation features run as Vercel serverless functions in `/api`, use the Vercel CLI to execute both the Vite client and the Node.js API handlers locally:

   ```bash
   # Install Vercel CLI globally if not already installed
   npm install -g vercel

   # Run local development environment
   vercel dev
   ```

### Building for Production

```bash
npm run build
```

---

## Deployment

The application is deployed on **Vercel**:

1. Connect the GitHub repository to a new Vercel project.
2. In the Vercel Project Settings, navigate to **Environment Variables**.
3. Add the following variable for Production and Preview environments:
   - `GROQ_API_KEY`: Your Groq Cloud API key.
4. Deploy using standard Vite build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

---

## Model Credit & Licensing

- **Model**: [Traditional Japanese Pagoda 3D Model](https://sketchfab.com/3d-models/traditional-japanese-pagoda-3d-model-8db99b4d14a44983bccddd9b34d64e81)
- **Author**: [QuennyTR](https://sketchfab.com/QuennyTR) via Sketchfab
- **License**: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

---

## Screenshots

<!-- TODO: Add screenshots to /docs/screenshots/ and update filenames as needed -->

![Architecture Atlas - Assembled View](/docs/screenshots/assembled-view.png)
*Fig 1. Default assembled view of the Japanese pagoda study model.*

![Architecture Atlas - Exploded Decomposition](/docs/screenshots/exploded-view.png)
*Fig 2. Exploded view showing separated vertical tiers and roof structures.*

![Architecture Atlas - AI Guide Tool Interaction](/docs/screenshots/ai-guide.png)
*Fig 3. Conversational AI Guide highlighting and explaining architectural components.*
