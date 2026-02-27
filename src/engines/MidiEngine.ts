import type { MidiState } from "../contracts/types";

export class MidiEngine {
  private state: MidiState = {
    connected: false,
    cc: {}
  };

  private midiAccess?: MIDIAccess;
  private mock = false;

  async init(): Promise<void> {
    if (this.mock) {
      this.state.connected = true;
      this.state.deviceName = "Mock MIDI";
      return;
    }

    if (!navigator.requestMIDIAccess) {
      this.state.connected = false;
      return;
    }

    this.midiAccess = await navigator.requestMIDIAccess();
    const input = this.midiAccess.inputs.values().next().value;
    if (!input) {
      this.state.connected = false;
      return;
    }

    this.state.connected = true;
    this.state.deviceName = input.name ?? "MIDI Input";
    input.onmidimessage = (event: MIDIMessageEvent) => {
      if (!event.data) return;
      this.handleMidiMessage(event.data);
    };
  }

  setMockEnabled(enabled: boolean): void {
    this.mock = enabled;
    if (enabled) {
      this.state.connected = true;
      this.state.deviceName = "Mock MIDI";
    }
  }

  injectMockCC(cc: number, value: number, ts = Date.now()): void {
    const normalized = Math.max(0, Math.min(1, value));
    this.state.cc[cc] = normalized;
    this.state.last = { cc, value: normalized, ts };
  }

  private handleMidiMessage(data: Uint8Array): void {
    const [status, data1, data2] = data;
    const isCc = (status & 0xf0) === 0xb0;
    if (!isCc) return;

    const cc = data1;
    const normalized = Math.max(0, Math.min(1, data2 / 127));
    this.state.cc[cc] = normalized;
    this.state.last = { cc, value: normalized, ts: Date.now() };
  }

  getState(): MidiState {
    return {
      connected: this.state.connected,
      deviceName: this.state.deviceName,
      cc: { ...this.state.cc },
      last: this.state.last
    };
  }

  dispose(): void {
    if (!this.midiAccess) return;
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = null;
    }
  }
}
