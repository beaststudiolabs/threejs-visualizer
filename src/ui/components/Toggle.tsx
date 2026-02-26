type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export const Toggle = ({ label, checked, onChange }: ToggleProps): JSX.Element => {
  return (
    <label className="control control-inline">
      <span className="control-label">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
};
