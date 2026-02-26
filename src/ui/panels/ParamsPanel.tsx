import type { ParamSchema } from "../../contracts/types";
import { Select } from "../components/Select";
import { Slider } from "../components/Slider";
import { Toggle } from "../components/Toggle";

type ParamsPanelProps = {
  schema: ParamSchema;
  params: Record<string, number | boolean | string>;
  onParamChange: (key: string, value: number | boolean | string) => void;
};

export const ParamsPanel = ({ schema, params, onParamChange }: ParamsPanelProps): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-params">
      <h3>Parameters</h3>
      {schema.map((item) => {
        const value = params[item.key] ?? item.default;

        if (item.type === "number") {
          return (
            <Slider
              key={item.key}
              id={`param-${item.key}`}
              label={item.label}
              min={item.min}
              max={item.max}
              step={item.step}
              value={Number(value)}
              onChange={(next) => onParamChange(item.key, next)}
            />
          );
        }

        if (item.type === "boolean") {
          return (
            <Toggle
              key={item.key}
              label={item.label}
              checked={Boolean(value)}
              onChange={(next) => onParamChange(item.key, next)}
            />
          );
        }

        if (item.type === "select") {
          return (
            <Select
              key={item.key}
              id={`param-${item.key}`}
              label={item.label}
              value={String(value)}
              options={item.options}
              onChange={(next) => onParamChange(item.key, next)}
            />
          );
        }

        return (
          <label className="control" key={item.key}>
            <span className="control-label">{item.label}</span>
            <input
              type="color"
              value={String(value)}
              onChange={(event) => onParamChange(item.key, event.target.value)}
            />
          </label>
        );
      })}
    </section>
  );
};
