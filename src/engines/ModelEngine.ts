import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export class ModelEngine {
  private readonly loader = new GLTFLoader();
  private readonly dracoLoader = new DRACOLoader();
  private model?: THREE.Group;

  constructor() {
    this.dracoLoader.setDecoderPath("/draco/gltf/");
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  async loadGLB(file: File): Promise<THREE.Group> {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      const model = this.sanitizeModel(gltf.scene);
      this.centerAndScale(model, 2);
      this.disposeObject(this.model);
      this.model = model;
      return model;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  sanitizeModel(source: THREE.Object3D): THREE.Group {
    const output = new THREE.Group();
    source.updateWorldMatrix(true, true);

    source.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) {
        return;
      }

      const geometry = (mesh.geometry as THREE.BufferGeometry).clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const material = this.createTexturelessMaterial(mesh.material);

      output.add(new THREE.Mesh(geometry, material));
    });

    return output;
  }

  centerAndScale(group: THREE.Object3D, targetSize = 2): void {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    group.position.sub(center);

    const maxAxis = Math.max(size.x, size.y, size.z);
    if (maxAxis > 0) {
      const scale = targetSize / maxAxis;
      group.scale.setScalar(scale);
    }
  }

  getModel(): THREE.Group | undefined {
    return this.model;
  }

  dispose(): void {
    this.disposeObject(this.model);
    this.model = undefined;
    this.dracoLoader.dispose();
  }

  private createTexturelessMaterial(source: THREE.Material | THREE.Material[]): THREE.MeshStandardMaterial {
    const material = Array.isArray(source) ? source[0] : source;
    const sourceColor =
      material && "color" in material && material.color instanceof THREE.Color
        ? material.color
        : new THREE.Color("#ffffff");

    return new THREE.MeshStandardMaterial({
      color: sourceColor.clone(),
      roughness: 0.8,
      metalness: 0.1
    });
  }

  private disposeObject(target?: THREE.Object3D): void {
    if (!target) return;

    target.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;

      (mesh.geometry as THREE.BufferGeometry | undefined)?.dispose();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) {
          material.dispose();
        }
      } else {
        mesh.material?.dispose();
      }
    });
  }
}
