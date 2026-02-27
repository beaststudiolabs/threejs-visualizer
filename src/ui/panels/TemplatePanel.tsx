import { useState } from "react";
import type { VisualizerTemplate } from "../../contracts/schema";
import type { TemplateId } from "../../contracts/types";

type TemplatePanelProps = {
  templates: VisualizerTemplate[];
  selectedTemplateId: TemplateId;
  seed: number;
  onTemplateChange: (id: TemplateId) => void;
  onSeedChange: (seed: number) => void;
  onModelLoad: (file: File) => void;
  loadedModelName?: string;
  modelLoading: boolean;
  modelError?: string;
};

export const TemplatePanel = ({
  templates,
  selectedTemplateId,
  seed,
  onTemplateChange,
  onSeedChange,
  onModelLoad,
  loadedModelName,
  modelLoading,
  modelError
}: TemplatePanelProps): JSX.Element => {
  const [selectedModelFile, setSelectedModelFile] = useState<File | undefined>(undefined);

  return (
    <section className="panel" data-testid="panel-template">
      <h3>Template</h3>
      <label className="control">
        <span className="control-label">Active Template</span>
        <select
          value={selectedTemplateId}
          onChange={(event) => onTemplateChange(event.target.value as TemplateId)}
          data-testid="template-select"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </label>

      <label className="control">
        <span className="control-label">Seed</span>
        <input
          type="number"
          value={seed}
          onChange={(event) => onSeedChange(Number(event.target.value))}
          data-testid="seed-input"
        />
      </label>

      <label className="control">
        <span className="control-label">GLB Model</span>
        <input
          type="file"
          accept=".glb,.gltf,model/gltf-binary"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              setSelectedModelFile(file);
            }
          }}
          data-testid="model-upload"
        />
      </label>

      <div className="button-row">
        <button
          type="button"
          disabled={!selectedModelFile || modelLoading}
          onClick={() => {
            if (!selectedModelFile) return;
            onModelLoad(selectedModelFile);
          }}
          data-testid="model-load"
        >
          {modelLoading ? "Loading..." : loadedModelName ? "Reload Model" : "Load Model"}
        </button>
      </div>

      <p className="telemetry">Selected: {selectedModelFile?.name ?? "None"}</p>
      <p className="telemetry">Loaded: {loadedModelName ?? "None"}</p>
      {modelError ? <p className="telemetry">Model Error: {modelError}</p> : null}
    </section>
  );
};
