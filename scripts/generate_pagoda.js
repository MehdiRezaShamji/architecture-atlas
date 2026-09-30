import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill FileReader for Node environment if needed by GLTFExporter
if (typeof global.FileReader === 'undefined') {
  global.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (this.onload) this.onload();
      }).catch(err => {
        if (this.onerror) this.onerror(err);
      });
    }
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a scene with nested pagoda hierarchy
const scene = new THREE.Scene();
scene.name = 'PagodaScene';

const baseGroup = new THREE.Group();
baseGroup.name = 'BaseStructure';

const foundationGeo = new THREE.BoxGeometry(4, 0.5, 4);
const foundationMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
const foundationMesh = new THREE.Mesh(foundationGeo, foundationMat);
foundationMesh.name = 'Foundation_Mesh';
baseGroup.add(foundationMesh);

const pagodaGroup = new THREE.Group();
pagodaGroup.name = 'PagodaLevels';

// Tier 1
const tier1Group = new THREE.Group();
tier1Group.name = 'Tier1_Level';
const body1Mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
body1Mesh.name = 'Tier1_Body';
body1Mesh.position.y = 1.25;
const roof1Mesh = new THREE.Mesh(new THREE.ConeGeometry(2.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
roof1Mesh.name = 'Tier1_Roof';
roof1Mesh.position.y = 2.65;
tier1Group.add(body1Mesh);
tier1Group.add(roof1Mesh);
pagodaGroup.add(tier1Group);

// Tier 2
const tier2Group = new THREE.Group();
tier2Group.name = 'Tier2_Level';
const body2Mesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
body2Mesh.name = 'Tier2_Body';
body2Mesh.position.y = 3.8;
const roof2Mesh = new THREE.Mesh(new THREE.ConeGeometry(2, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
roof2Mesh.name = 'Tier2_Roof';
roof2Mesh.position.y = 4.9;
tier2Group.add(body2Mesh);
tier2Group.add(roof2Mesh);
pagodaGroup.add(tier2Group);

scene.add(baseGroup);
scene.add(pagodaGroup);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (gltf) => {
    const buffer = Buffer.from(gltf);
    const outputPath = path.join(__dirname, '../public/models/pagoda.glb');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log('Successfully generated pagoda.glb at:', outputPath);
  },
  (error) => {
    console.error('An error occurred exporting GLTF:', error);
  },
  { binary: true }
);
