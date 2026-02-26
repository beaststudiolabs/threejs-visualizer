type ExportPanelProps = {
  onExportZip: () => void;
  onExportEmbed: () => void;
  onCopyEmbed: () => void;
};

export const ExportPanel = ({ onExportZip, onExportEmbed, onCopyEmbed }: ExportPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-export">
      <h3>Export</h3>
      <div className="button-row">
        <button type="button" onClick={onExportZip} data-testid="export-zip">
          Export Zip
        </button>
        <button type="button" onClick={onExportEmbed} data-testid="export-embed">
          Export Embed HTML
        </button>
        <button type="button" onClick={onCopyEmbed} data-testid="copy-embed">
          Copy Embed
        </button>
      </div>
    </section>
  );
};
