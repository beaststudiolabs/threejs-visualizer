import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";

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
        key: "rotationSpeed",
        type: "number",
        label: "Rotation",
        group: "Motion",
        min: 0,
        max: 3,
        step: 0.01,
        default: 0.3
      },
      {
        key: "color",
        type: "color",
        label: "Glow Color",
        group: "Style",
        default: "#ffd86b"
      }
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      pointSize: 0.04,
      rotationSpeed: 0.3,
      color: "#ffd86b"
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;

    const model = params.model as THREE.Object3D | undefined;
    const geometry = this.extractGeometry(model);
    const material = new THREE.PointsMaterial({
      color: String(params.color ?? "#ffd86b"),
      size: Number(params.pointSize ?? 0.04),
      sizeAttenuation: true
    });

    this.points = new THREE.Points(geometry, material);
    ctx.scene.add(this.points);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.points) return;

    const speed = Number(runtime.params.rotationSpeed ?? 0.3);
    const pointSize = Number(runtime.params.pointSize ?? 0.04);
    const color = String(runtime.params.color ?? "#ffd86b");

    this.points.rotation.y = runtime.loopT * Math.PI * 2 * speed;
    this.points.rotation.z = runtime.loopT * Math.PI * speed * 0.7;

    const material = this.points.material as THREE.PointsMaterial;
    material.size = pointSize;
    material.color.set(color);
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
    if (!model) {
      return new THREE.IcosahedronGeometry(1.1, 3);
    }

    const positions: number[] = [];
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geom = mesh.geometry;
      const pos = geom.getAttribute("position");
      for (let i = 0; i < pos.count; i += 1) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    });

    if (positions.length === 0) {
      return new THREE.IcosahedronGeometry(1.1, 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }
}

export const modelVertexGlowTemplate = new ModelVertexGlowTemplate();
