import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyRadialGradientToGeometry, resolveGradientColors } from "../../src/templates/gradient";

const FALLBACK = ["#111111", "#222222", "#333333", "#444444", "#555555"] as const;

const makeGeometry = (): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, 0,
        1, 0, 0,
        2, 0, 0,
        3, 0, 0,
        4, 0, 0
      ]),
      3
    )
  );
  return geometry;
};

const colorAt = (attr: THREE.BufferAttribute, index: number): THREE.Color =>
  new THREE.Color(attr.getX(index), attr.getY(index), attr.getZ(index));

describe("gradient utilities", () => {
  it("resolves active color stops between 2 and 5", () => {
    expect(resolveGradientColors({ gradientStops: 2, color: "#aaaaaa", color2: "#bbbbbb" }, FALLBACK)).toEqual([
      "#aaaaaa",
      "#bbbbbb"
    ]);
    expect(resolveGradientColors({ gradientStops: 5, color: "#aaaaaa" }, FALLBACK)).toEqual([
      "#aaaaaa",
      FALLBACK[1],
      FALLBACK[2],
      FALLBACK[3],
      FALLBACK[4]
    ]);
  });

  it("applies radial gradient color attribute to geometry", () => {
    const geometry = makeGeometry();

    applyRadialGradientToGeometry(
      geometry,
      {
        gradientStops: 2,
        color: "#ff0000",
        color2: "#0000ff"
      },
      FALLBACK
    );

    const color = geometry.getAttribute("color") as THREE.BufferAttribute;
    expect(color.count).toBe(5);

    const near = colorAt(color, 2);
    const far = colorAt(color, 0);

    expect(near.r).toBeGreaterThan(near.b);
    expect(far.b).toBeGreaterThan(far.r);

    geometry.dispose();
  });

  it("supports 3, 4, and 5-stop gradients", () => {
    for (const stops of [3, 4, 5]) {
      const geometry = makeGeometry();

      applyRadialGradientToGeometry(
        geometry,
        {
          gradientStops: stops,
          color: "#ff0000",
          color2: "#00ff00",
          color3: "#0000ff",
          color4: "#ffff00",
          color5: "#00ffff"
        },
        FALLBACK
      );

      const color = geometry.getAttribute("color") as THREE.BufferAttribute;
      const first = colorAt(color, 2);
      const mid = colorAt(color, 1);
      const last = colorAt(color, 0);

      expect(first.r).toBeGreaterThan(first.g + first.b);
      expect(mid.r + mid.g + mid.b).toBeGreaterThan(0);
      expect(last.r + last.g + last.b).toBeGreaterThan(0);

      geometry.dispose();
    }
  });
});
