import { useMemo } from "react";
import type { ChangeEvent } from "react";

type SliderProps = {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
};

export const Slider = ({ id, label, min, max, step = 0.01, value, onChange }: SliderProps): JSX.Element => {
  const safeValue = useMemo(() => (Number.isFinite(value) ? value : min), [value, min]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(Number(event.target.value));
  };

  return (
    <label className="control" htmlFor={id}>
      <span className="control-label">{label}</span>
      <input id={id} type="range" min={min} max={max} step={step} value={safeValue} onChange={handleChange} />
      <span className="control-value">{safeValue.toFixed(2)}</span>
    </label>
  );
};
