export type HotkeyBindings = {
  toggleLeft?: () => void;
  toggleRight?: () => void;
  toggleBottom?: () => void;
};

export class InputHotkeys {
  private unbind?: () => void;

  bind(bindings: HotkeyBindings): void {
    this.unbind?.();

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === "1") bindings.toggleLeft?.();
      if (event.key === "2") bindings.toggleRight?.();
      if (event.key === "3") bindings.toggleBottom?.();
    };

    window.addEventListener("keydown", onKeydown);
    this.unbind = () => window.removeEventListener("keydown", onKeydown);
  }

  dispose(): void {
    this.unbind?.();
    this.unbind = undefined;
  }
}
