import * as THREE from "three";

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#050508");

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 0.8);
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(3, 4, 5);
    this.scene.add(hemi, dir);
  }

  resize(width: number, height: number): void {
    const safeHeight = Math.max(height, 1);
    this.camera.aspect = width / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, safeHeight, false);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
