type PresetsPanelProps = {
  presets: string[];
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onImport: (content: string) => void;
  onExport: (name: string) => void;
};

export const PresetsPanel = ({
  presets,
  onSave,
  onLoad,
  onDelete,
  onImport,
  onExport
}: PresetsPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-presets">
      <h3>Presets</h3>

      <div className="control control-inline">
        <input id="preset-name" defaultValue="default" />
        <button
          type="button"
          data-testid="preset-save"
          onClick={() => {
            const name = (document.getElementById("preset-name") as HTMLInputElement).value;
            onSave(name);
          }}
        >
          Save
        </button>
      </div>

      <label className="control">
        <span className="control-label">Import Preset</span>
        <input
          type="file"
          accept="application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const content = await file.text();
            onImport(content);
          }}
        />
      </label>

      <ul className="list" data-testid="preset-list">
        {presets.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <div className="button-row">
              <button type="button" onClick={() => onLoad(name)}>
                Load
              </button>
              <button type="button" onClick={() => onExport(name)}>
                Export
              </button>
              <button type="button" onClick={() => onDelete(name)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
