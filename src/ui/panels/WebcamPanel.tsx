import type { MotionState } from "../../contracts/types";
import { Slider } from "../components/Slider";
import { Toggle } from "../components/Toggle";

type WebcamPanelProps = {
  state: MotionState;
  mockEnabled: boolean;
  onMockToggle: (enabled: boolean) => void;
  onMockIntensity: (value: number) => void;
};

export const WebcamPanel = ({
  state,
  mockEnabled,
  onMockToggle,
  onMockIntensity
}: WebcamPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-webcam">
      <h3>Webcam</h3>
      <Toggle label="Mock Webcam" checked={mockEnabled} onChange={onMockToggle} />
      <p className="telemetry">Enabled: {state.enabled ? "Yes" : "No"}</p>
      <p className="telemetry">Intensity: {state.intensity.toFixed(3)}</p>
      <Slider
        id="webcam-mock"
        label="Mock Motion"
        min={0}
        max={1}
        step={0.01}
        value={state.intensity}
        onChange={onMockIntensity}
      />
    </section>
  );
};
