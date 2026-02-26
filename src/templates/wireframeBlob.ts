import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";

class WireframeBlobTemplate implements VisualizerTemplate {
  readonly id = "wireframeBlob" as const;
  readonly label = "Wireframe Blob";

  private mesh?: THREE.Mesh;
  private ctx?: TemplateContext;

  getParamSchema(): ParamSchema {
    return [
      {
        key: "density",
        type: "number",
        label: "Density",
        group: "Geometry",
        min: 1,
        max: 5,
        step: 1,
        default: 2,
        curve: "linear"
      },
      {
        key: "rotationSpeed",
        type: "number",
        label: "Rotation",
        group: "Motion",
        min: 0,
        max: 3,
        step: 0.01,
        default: 0.8,
        curve: "smoothstep"
      },
      {
        key: "scale",
        type: "number",
        label: "Scale",
        group: "Geometry",
        min: 0.2,
        max: 3,
        step: 0.01,
        default: 1,
        curve: "linear"
      },
      {
        key: "color",
        type: "color",
        label: "Wire Color",
        group: "Style",
        default: "#43ffd0"
      }
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      density: 2,
      rotationSpeed: 0.8,
      scale: 1,
      color: "#43ffd0"
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;
    const density = Math.min(5, Math.max(1, Math.floor(Number(params.density) || 2)));
    const color = String(params.color ?? "#43ffd0");

    const geometry = new THREE.IcosahedronGeometry(1, density);
    const material = new THREE.MeshBasicMaterial({ color, wireframe: true });

    this.mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(this.mesh);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.mesh) return;

    const speed = Number(runtime.params.rotationSpeed ?? 0.8);
    const scale = Number(runtime.params.scale ?? 1);
    const color = String(runtime.params.color ?? "#43ffd0");

    (this.mesh.material as THREE.MeshBasicMaterial).color.set(color);

    const seedPhase = runtime.seed * 0.0007;
    this.mesh.rotation.x = 2 * Math.PI * runtime.loopT * speed + seedPhase;
    this.mesh.rotation.y = 2 * Math.PI * runtime.loopT * speed * 0.8 + seedPhase;
    this.mesh.scale.setScalar(scale);
  }

  dispose(): void {
    if (!this.mesh || !this.ctx) return;
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh = undefined;
    this.ctx = undefined;
  }
}

export const wireframeBlobTemplate = new WireframeBlobTemplate();

