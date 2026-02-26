import type { VisualizerTemplate } from "../contracts/schema";
import type { TemplateId } from "../contracts/types";
import { modelEdgesTemplate } from "./modelEdges";
import { modelVertexGlowTemplate } from "./modelVertexGlow";
import { pointCloudOrbTemplate } from "./pointCloudOrb";
import { spiroRingTemplate } from "./spiroRing";
import { wireframeBlobTemplate } from "./wireframeBlob";

export class TemplateRegistry {
  private readonly templates = new Map<TemplateId, VisualizerTemplate>();

  register(template: VisualizerTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: TemplateId): VisualizerTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }
    return template;
  }

  list(): VisualizerTemplate[] {
    return [...this.templates.values()];
  }
}

export const createTemplateRegistry = (): TemplateRegistry => {
  const registry = new TemplateRegistry();
  registry.register(wireframeBlobTemplate);
  registry.register(spiroRingTemplate);
  registry.register(pointCloudOrbTemplate);
  registry.register(modelEdgesTemplate);
  registry.register(modelVertexGlowTemplate);
  return registry;
};
