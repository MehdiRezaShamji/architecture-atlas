import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NodeIO } from '@gltf-transform/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target model path: /public/models/pagoda.glb
const defaultModelPath = path.resolve(__dirname, 'public', 'models', 'pagoda.glb');
const modelPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultModelPath;

if (!fs.existsSync(modelPath)) {
  console.error(`Error: Model file not found at "${modelPath}".`);
  process.exit(1);
}

async function inspectModel() {
  const io = new NodeIO();
  const doc = await io.read(modelPath);
  const root = doc.getRoot();

  const meshes = root.listMeshes();
  if (meshes.length === 0) {
    console.log('No meshes found in model.');
    return;
  }

  // Map nodes to meshes for descriptive naming
  const meshData = meshes.map((mesh) => {
    const rawMeshName = mesh.getName() || 'unnamed';
    const associatedNodes = root
      .listNodes()
      .filter((node) => node.getMesh() === mesh)
      .map((node) => node.getName())
      .filter(Boolean);

    const nodeName = associatedNodes.length > 0 ? associatedNodes.join(', ') : null;
    const displayName = nodeName && nodeName !== rawMeshName
      ? `${nodeName} (${rawMeshName})`
      : (nodeName || rawMeshName);

    let vertexCount = 0;
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;

      vertexCount += position.getCount();

      let pMin = position.getMin([]);
      let pMax = position.getMax([]);

      // Fallback in case accessor min/max are missing
      if (!pMin || !pMax || pMin.length < 3 || pMax.length < 3) {
        pMin = [Infinity, Infinity, Infinity];
        pMax = [-Infinity, -Infinity, -Infinity];
        const temp = [];
        for (let i = 0; i < position.getCount(); i++) {
          position.getElement(i, temp);
          for (let j = 0; j < 3; j++) {
            pMin[j] = Math.min(pMin[j], temp[j]);
            pMax[j] = Math.max(pMax[j], temp[j]);
          }
        }
      }

      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], pMin[j]);
        max[j] = Math.max(max[j], pMax[j]);
      }
    }

    if (vertexCount === 0) {
      min = [0, 0, 0];
      max = [0, 0, 0];
    }

    const ySpan = max[1] - min[1];

    return {
      mesh,
      rawMeshName,
      nodeName,
      displayName,
      vertexCount,
      min,
      max,
      ySpan,
    };
  });

  // Sort by minimum Y ascending (bottom-to-top: base first, spire last)
  meshData.sort((a, b) => {
    if (a.min[1] !== b.min[1]) {
      return a.min[1] - b.min[1];
    }
    return a.max[1] - b.max[1];
  });

  console.log('================================================================================');
  console.log(`GLTF MODEL INSPECTION: ${path.relative(__dirname, modelPath).replace(/\\/g, '/')}`);
  console.log('Sorted by minimum Y ascending (bottom-to-top: base first, spire last)');
  console.log('================================================================================\n');

  meshData.forEach((item, index) => {
    console.log(`[Mesh ${index + 1}]`);
    console.log(`  Mesh Name   : ${item.displayName}`);
    console.log(`  Vertex Count: ${item.vertexCount.toLocaleString()}`);
    console.log(`  Bounding Box:`);
    console.log(
      `    Min (XYZ) : [${item.min[0].toFixed(6)}, ${item.min[1].toFixed(6)}, ${item.min[2].toFixed(6)}]`
    );
    console.log(
      `    Max (XYZ) : [${item.max[0].toFixed(6)}, ${item.max[1].toFixed(6)}, ${item.max[2].toFixed(6)}]`
    );
    console.log(`  Y-axis Span : ${item.ySpan.toFixed(6)}`);
    console.log('');
  });

  // Calculate median Y-span across all meshes
  const ySpans = meshData.map((m) => m.ySpan).sort((a, b) => a - b);
  const mid = Math.floor(ySpans.length / 2);
  const medianYSpan =
    ySpans.length % 2 !== 0
      ? ySpans[mid]
      : (ySpans[mid - 1] + ySpans[mid]) / 2;

  const threshold = 2 * medianYSpan;

  console.log('================================================================================');
  console.log('ANALYSIS & ANOMALY DETECTION');
  console.log('================================================================================');
  console.log(`Total Meshes      : ${meshData.length}`);
  console.log(`Median Y-axis Span: ${medianYSpan.toFixed(6)}`);
  console.log(`Threshold (2x)    : ${threshold.toFixed(6)}\n`);

  const suspiciousMeshes = meshData.filter((m) => m.ySpan > threshold);

  if (suspiciousMeshes.length === 0) {
    console.log('No meshes exceeded 2x the median Y-axis span.');
  } else {
    console.log('SUSPICIOUSLY TALL — may contain merged/misjoined geometry from multiple parts:');
    suspiciousMeshes.forEach((item) => {
      const ratio = (item.ySpan / medianYSpan).toFixed(2);
      console.log(
        `  - ${item.displayName}: Y-span = ${item.ySpan.toFixed(6)} (${ratio}x median)`
      );
      console.log(
        `    Y-bounds: [min Y: ${item.min[1].toFixed(6)}, max Y: ${item.max[1].toFixed(6)}] | Vertices: ${item.vertexCount}`
      );
    });
  }
  console.log('\n================================================================================');
}

inspectModel().catch((err) => {
  console.error('Failed to inspect model:', err);
  process.exit(1);
});
