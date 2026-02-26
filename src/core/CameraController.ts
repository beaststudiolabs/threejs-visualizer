import type { CameraState } from "../contracts/types";
import * as THREE from "three";

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3(0, 0, 0);
  private mode: CameraState["mode"] = "orbit";

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  setState(state: CameraState): void {
    this.mode = state.mode;
    this.camera.position.set(...state.position);
    this.target.set(...state.target);
    this.camera.fov = state.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.target);
  }

  getState(): CameraState {
    return {
      mode: this.mode,
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.target.x, this.target.y, this.target.z],
      fov: this.camera.fov
    };
  }
}
