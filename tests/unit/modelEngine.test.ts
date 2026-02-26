import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ModelEngine } from "../../src/engines/ModelEngine";

describe("ModelEngine", () => {
  it("centers and scales object to target size", () => {
    const engine = new ModelEngine();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial()));

    engine.centerAndScale(group, 2);

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2, 1);
  });
});
