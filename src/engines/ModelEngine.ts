import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ModelEngine {
  private readonly loader = new GLTFLoader();
  private model?: THREE.Group;

  async loadGLB(file: File): Promise<THREE.Group> {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.loader.loadAsync(url);
      const model = gltf.scene;
      this.centerAndScale(model, 2);
      this.model = model;
      return model;
    } finally {
      URL.revokeObjectURL(url);
    }
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
    this.model = undefined;
  }
}
