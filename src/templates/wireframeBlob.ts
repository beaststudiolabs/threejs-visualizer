import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";
import { applyRadialGradientToGeometry, createGradientParamSchema } from "./gradient";

const WIREFRAME_GRADIENT_DEFAULTS = ["#43ffd0", "#2b74ff", "#8aa3ff", "#ff7ac9", "#ffaf45"] as const;

class WireframeBlobTemplate implements VisualizerTemplate {
  readonly id = "wireframeBlob" as const;
  readonly label = "Wireframe Blob";

  private mesh?: THREE.Mesh;
  private ctx?: TemplateContext;
  private builtDensity?: number;

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
      ...createGradientParamSchema(WIREFRAME_GRADIENT_DEFAULTS, "Style")
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      density: 2,
      rotationSpeed: 0.8,
      scale: 1,
      gradientStops: 2,
      color: WIREFRAME_GRADIENT_DEFAULTS[0],
      color2: WIREFRAME_GRADIENT_DEFAULTS[1],
      color3: WIREFRAME_GRADIENT_DEFAULTS[2],
      color4: WIREFRAME_GRADIENT_DEFAULTS[3],
      color5: WIREFRAME_GRADIENT_DEFAULTS[4]
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;
    const density = Math.max(1, Math.floor(Number(params.density) || 2));

    const geometry = new THREE.IcosahedronGeometry(1, density);
    applyRadialGradientToGeometry(geometry, params, WIREFRAME_GRADIENT_DEFAULTS);
    const material = new THREE.MeshBasicMaterial({ color: "#ffffff", wireframe: true, vertexColors: true });

    this.mesh = new THREE.Mesh(geometry, material);
    this.builtDensity = density;
    ctx.scene.add(this.mesh);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.mesh) return;

    const density = Math.max(1, Math.floor(Number(runtime.params.density ?? 2)));
    const speed = Number(runtime.params.rotationSpeed ?? 0.8);
    const scale = Number(runtime.params.scale ?? 1);

    if (this.builtDensity !== density) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.IcosahedronGeometry(1, density);
      this.builtDensity = density;
    }

    applyRadialGradientToGeometry(this.mesh.geometry as THREE.BufferGeometry, runtime.params, WIREFRAME_GRADIENT_DEFAULTS);

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
    this.builtDensity = undefined;
  }
}

export const wireframeBlobTemplate = new WireframeBlobTemplate();
