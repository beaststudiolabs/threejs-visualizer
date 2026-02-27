import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ModelEngine } from "../../src/engines/ModelEngine";

describe("ModelEngine", () => {
  it("sanitizes source model to meshes only and strips texture maps", () => {
    const engine = new ModelEngine();
    const source = new THREE.Group();
    const meshMaterial = new THREE.MeshStandardMaterial({
      color: "#ff8855",
      map: new THREE.Texture()
    });

    source.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), meshMaterial));
    source.add(new THREE.PointLight(0xffffff, 1));

    const sanitized = engine.sanitizeModel(source);

    expect(sanitized.children.length).toBe(1);

    const child = sanitized.children[0] as THREE.Mesh;
    expect(child.isMesh).toBe(true);

    const material = child.material as THREE.MeshStandardMaterial;
    expect(material.map).toBeNull();
    expect(material.color.getHexString()).toBe("ff8855");

    meshMaterial.dispose();
  });

  it("centers and scales object to target size", () => {
    const engine = new ModelEngine();
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial()));
    const group = engine.sanitizeModel(source);

    engine.centerAndScale(group, 2);

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2, 1);
  });
});
