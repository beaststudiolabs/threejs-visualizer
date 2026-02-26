import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";

class ModelEdgesTemplate implements VisualizerTemplate {
  readonly id = "modelEdges" as const;
  readonly label = "Model Edges";

  private lineSegments?: THREE.LineSegments;
  private ctx?: TemplateContext;

  getParamSchema(): ParamSchema {
    return [
      {
        key: "rotationSpeed",
        type: "number",
        label: "Rotation",
        group: "Motion",
        min: 0,
        max: 3,
        step: 0.01,
        default: 0.4
      },
      {
        key: "color",
        type: "color",
        label: "Edge Color",
        group: "Style",
        default: "#ffffff"
      }
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      rotationSpeed: 0.4,
      color: "#ffffff"
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;

    const sourceModel = params.model as THREE.Object3D | undefined;
    let geometry: THREE.BufferGeometry;

    if (sourceModel) {
      const boxed = new THREE.Box3().setFromObject(sourceModel);
      const size = new THREE.Vector3();
      boxed.getSize(size);
      geometry = new THREE.BoxGeometry(size.x || 1, size.y || 1, size.z || 1);
    } else {
      geometry = new THREE.TorusKnotGeometry(1, 0.3, 140, 24);
    }

    const edges = new THREE.EdgesGeometry(geometry, 30);
    const material = new THREE.LineBasicMaterial({ color: String(params.color ?? "#ffffff") });

    this.lineSegments = new THREE.LineSegments(edges, material);
    ctx.scene.add(this.lineSegments);
    geometry.dispose();
  }

  update(runtime: TemplateRuntime): void {
    if (!this.lineSegments) return;

    const speed = Number(runtime.params.rotationSpeed ?? 0.4);
    const color = String(runtime.params.color ?? "#ffffff");

    this.lineSegments.rotation.y = runtime.loopT * Math.PI * 2 * speed;
    this.lineSegments.rotation.x = runtime.loopT * Math.PI * speed;
    (this.lineSegments.material as THREE.LineBasicMaterial).color.set(color);
  }

  dispose(): void {
    if (!this.lineSegments || !this.ctx) return;
    this.ctx.scene.remove(this.lineSegments);
    this.lineSegments.geometry.dispose();
    (this.lineSegments.material as THREE.Material).dispose();
    this.lineSegments = undefined;
    this.ctx = undefined;
  }
}

export const modelEdgesTemplate = new ModelEdgesTemplate();
