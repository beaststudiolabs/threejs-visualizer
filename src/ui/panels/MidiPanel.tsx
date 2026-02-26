import type { MidiState } from "../../contracts/types";
import { Toggle } from "../components/Toggle";

type MidiPanelProps = {
  state: MidiState;
  mockEnabled: boolean;
  onMockToggle: (enabled: boolean) => void;
  onInjectCc: (cc: number, value: number) => void;
};

export const MidiPanel = ({ state, mockEnabled, onMockToggle, onInjectCc }: MidiPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-midi">
      <h3>MIDI</h3>
      <Toggle label="Mock MIDI" checked={mockEnabled} onChange={onMockToggle} />
      <p className="telemetry">Connected: {state.connected ? "Yes" : "No"}</p>
      <p className="telemetry">Device: {state.deviceName ?? "None"}</p>

      <div className="button-row">
        <button type="button" onClick={() => onInjectCc(48, 0)}>
          CC48 Low
        </button>
        <button type="button" onClick={() => onInjectCc(48, 1)}>
          CC48 High
        </button>
      </div>
    </section>
  );
};
