import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";
import { extractTransformedModelPositions } from "./modelGeometry";
import { applyRadialGradientToGeometry, createGradientParamSchema } from "./gradient";

const clampGlowAmount = (value: number): number => THREE.MathUtils.clamp(value, 0, 2);
const glowIntensityFromAmount = (amount: number): number => THREE.MathUtils.lerp(0.25, 2.2, amount / 2);
const glowOpacityFromAmount = (amount: number): number => THREE.MathUtils.lerp(0.05, 0.85, amount / 2);
const MODEL_VERTEX_GRADIENT_DEFAULTS = ["#ffd86b", "#ff8f8f", "#a27dff", "#57ccff", "#43ffd0"] as const;

class ModelVertexGlowTemplate implements VisualizerTemplate {
  readonly id = "modelVertexGlow" as const;
  readonly label = "Model Vertex Glow";

  private points?: THREE.Points;
  private ctx?: TemplateContext;

  getParamSchema(): ParamSchema {
    return [
      {
        key: "pointSize",
        type: "number",
        label: "Point Size",
        group: "Style",
        min: 0.01,
        max: 0.2,
        step: 0.01,
        default: 0.04
      },
      {
        key: "glowAmount",
        type: "number",
        label: "Glow Amount",
        group: "Style",
        min: 0,
        max: 2,
        step: 0.01,
        default: 1
      },
      {
        key: "rotationSpeed",
        type: "number",
        label: "Rotation",
        group: "Motion",
        min: 0,
        max: 3,
        step: 0.01,
        default: 0.3
      },
      ...createGradientParamSchema(MODEL_VERTEX_GRADIENT_DEFAULTS, "Style")
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      pointSize: 0.04,
      glowAmount: 1,
      rotationSpeed: 0.3,
      gradientStops: 2,
      color: MODEL_VERTEX_GRADIENT_DEFAULTS[0],
      color2: MODEL_VERTEX_GRADIENT_DEFAULTS[1],
      color3: MODEL_VERTEX_GRADIENT_DEFAULTS[2],
      color4: MODEL_VERTEX_GRADIENT_DEFAULTS[3],
      color5: MODEL_VERTEX_GRADIENT_DEFAULTS[4]
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;

    const model = params.model as THREE.Object3D | undefined;
    const geometry = this.extractGeometry(model);
    applyRadialGradientToGeometry(geometry, params, MODEL_VERTEX_GRADIENT_DEFAULTS);
    const glowAmount = clampGlowAmount(Number(params.glowAmount ?? 1));
    const material = new THREE.PointsMaterial({
      color: "#ffffff",
      vertexColors: true,
      size: Number(params.pointSize ?? 0.04),
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: glowOpacityFromAmount(glowAmount)
    });
    material.color.setRGB(1, 1, 1).multiplyScalar(glowIntensityFromAmount(glowAmount));

    this.points = new THREE.Points(geometry, material);
    ctx.scene.add(this.points);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.points) return;

    const speed = Number(runtime.params.rotationSpeed ?? 0.3);
    const pointSize = Number(runtime.params.pointSize ?? 0.04);
    const glowAmount = clampGlowAmount(Number(runtime.params.glowAmount ?? 1));

    this.points.rotation.y = runtime.loopT * Math.PI * 2 * speed;
    this.points.rotation.z = runtime.loopT * Math.PI * speed * 0.7;
    applyRadialGradientToGeometry(this.points.geometry as THREE.BufferGeometry, runtime.params, MODEL_VERTEX_GRADIENT_DEFAULTS);

    const material = this.points.material as THREE.PointsMaterial;
    material.size = pointSize;
    material.opacity = glowOpacityFromAmount(glowAmount);
    material.color.setRGB(1, 1, 1).multiplyScalar(glowIntensityFromAmount(glowAmount));
  }

  dispose(): void {
    if (!this.points || !this.ctx) return;
    this.ctx.scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points = undefined;
    this.ctx = undefined;
  }

  private extractGeometry(model?: THREE.Object3D): THREE.BufferGeometry {
    const positions = extractTransformedModelPositions(model);
    if (!positions || positions.length === 0) {
      return new THREE.IcosahedronGeometry(1.1, 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }
}

export const modelVertexGlowTemplate = new ModelVertexGlowTemplate();
