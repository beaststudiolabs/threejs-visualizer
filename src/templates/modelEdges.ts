import type { TemplateContext, TemplateRuntime, VisualizerTemplate } from "../contracts/schema";
import type { ParamSchema } from "../contracts/types";
import * as THREE from "three";
import { collectTransformedMeshGeometries } from "./modelGeometry";
import { applyRadialGradientToGeometry, createGradientParamSchema } from "./gradient";

const MODEL_EDGE_GRADIENT_DEFAULTS = ["#ffffff", "#7ec8ff", "#84fab0", "#ffe66d", "#ff8f8f"] as const;

class ModelEdgesTemplate implements VisualizerTemplate {
  readonly id = "modelEdges" as const;
  readonly label = "Model Edges";

  private edgeGroup?: THREE.Group;
  private material?: THREE.LineBasicMaterial;
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
      ...createGradientParamSchema(MODEL_EDGE_GRADIENT_DEFAULTS, "Style")
    ];
  }

  getDefaultParams(): Record<string, any> {
    return {
      rotationSpeed: 0.4,
      gradientStops: 2,
      color: MODEL_EDGE_GRADIENT_DEFAULTS[0],
      color2: MODEL_EDGE_GRADIENT_DEFAULTS[1],
      color3: MODEL_EDGE_GRADIENT_DEFAULTS[2],
      color4: MODEL_EDGE_GRADIENT_DEFAULTS[3],
      color5: MODEL_EDGE_GRADIENT_DEFAULTS[4]
    };
  }

  init(ctx: TemplateContext, params: Record<string, any>): void {
    this.ctx = ctx;

    const sourceModel = params.model as THREE.Object3D | undefined;
    this.material = new THREE.LineBasicMaterial({ color: "#ffffff", vertexColors: true });
    this.edgeGroup = new THREE.Group();

    const transformedGeometries = collectTransformedMeshGeometries(sourceModel);
    if (transformedGeometries.length > 0) {
      for (const geometry of transformedGeometries) {
        const edges = new THREE.EdgesGeometry(geometry, 30);
        applyRadialGradientToGeometry(edges, params, MODEL_EDGE_GRADIENT_DEFAULTS);
        this.edgeGroup.add(new THREE.LineSegments(edges, this.material));
        geometry.dispose();
      }
    } else {
      const fallbackGeometry = new THREE.TorusKnotGeometry(1, 0.3, 140, 24);
      const edges = new THREE.EdgesGeometry(fallbackGeometry, 30);
      applyRadialGradientToGeometry(edges, params, MODEL_EDGE_GRADIENT_DEFAULTS);
      fallbackGeometry.dispose();
      this.edgeGroup.add(new THREE.LineSegments(edges, this.material));
    }

    ctx.scene.add(this.edgeGroup);
  }

  update(runtime: TemplateRuntime): void {
    if (!this.edgeGroup || !this.material) return;

    const speed = Number(runtime.params.rotationSpeed ?? 0.4);

    this.edgeGroup.rotation.y = runtime.loopT * Math.PI * 2 * speed;
    this.edgeGroup.rotation.x = runtime.loopT * Math.PI * speed;

    for (const child of this.edgeGroup.children) {
      const line = child as THREE.LineSegments;
      applyRadialGradientToGeometry(line.geometry as THREE.BufferGeometry, runtime.params, MODEL_EDGE_GRADIENT_DEFAULTS);
    }
  }

  dispose(): void {
    if (!this.edgeGroup || !this.ctx) return;
    this.ctx.scene.remove(this.edgeGroup);

    for (const child of this.edgeGroup.children) {
      const line = child as THREE.LineSegments;
      line.geometry.dispose();
    }

    this.edgeGroup.clear();
    this.material?.dispose();
    this.material = undefined;
    this.edgeGroup = undefined;
    this.ctx = undefined;
  }
}

export const modelEdgesTemplate = new ModelEdgesTemplate();
