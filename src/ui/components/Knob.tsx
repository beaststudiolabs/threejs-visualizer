import { Slider } from "./Slider";

type KnobProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export const Knob = (props: KnobProps): JSX.Element => {
  return <Slider {...props} />;
};
