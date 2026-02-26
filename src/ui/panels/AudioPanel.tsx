import type { AudioFeatures } from "../../contracts/types";
import { Toggle } from "../components/Toggle";

type AudioPanelProps = {
  features: AudioFeatures;
  mockEnabled: boolean;
  onMockToggle: (enabled: boolean) => void;
  onUpload: (file: File) => void;
  onPlay: () => void;
  onPause: () => void;
};

export const AudioPanel = ({
  features,
  mockEnabled,
  onMockToggle,
  onUpload,
  onPlay,
  onPause
}: AudioPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-audio">
      <h3>Audio</h3>
      <Toggle label="Mock Audio" checked={mockEnabled} onChange={onMockToggle} />

      <label className="control">
        <span className="control-label">Audio File</span>
        <input
          type="file"
          accept="audio/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
      </label>

      <div className="button-row">
        <button type="button" onClick={onPlay}>
          Play
        </button>
        <button type="button" onClick={onPause}>
          Pause
        </button>
      </div>

      <p className="telemetry">RMS: {features.rms.toFixed(3)}</p>
      <p className="telemetry">Bass/Mids/Highs: {features.bass.toFixed(3)} / {features.mids.toFixed(3)} / {features.highs.toFixed(3)}</p>
    </section>
  );
};
