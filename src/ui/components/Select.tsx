import type { ChangeEvent } from "react";

type Option = { label: string; value: string };

type SelectProps = {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

export const Select = ({ id, label, value, options, onChange }: SelectProps): JSX.Element => {
  const handle = (event: ChangeEvent<HTMLSelectElement>): void => onChange(event.target.value);

  return (
    <label className="control" htmlFor={id}>
      <span className="control-label">{label}</span>
      <select id={id} value={value} onChange={handle}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};
