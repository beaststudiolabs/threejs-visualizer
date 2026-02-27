import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { collectTransformedMeshGeometries, extractTransformedModelPositions } from "../../src/templates/modelGeometry";

const toBoxFromPositions = (positions: Float32Array): THREE.Box3 => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(position);
  geometry.dispose();
  return box;
};

const expectBoxClose = (actual: THREE.Box3, expected: THREE.Box3, precision = 3): void => {
  expect(actual.min.x).toBeCloseTo(expected.min.x, precision);
  expect(actual.min.y).toBeCloseTo(expected.min.y, precision);
  expect(actual.min.z).toBeCloseTo(expected.min.z, precision);
  expect(actual.max.x).toBeCloseTo(expected.max.x, precision);
  expect(actual.max.y).toBeCloseTo(expected.max.y, precision);
  expect(actual.max.z).toBeCloseTo(expected.max.z, precision);
};

describe("model template geometry helpers", () => {
  it("extracts glow points in world space and matches transformed model bounds", () => {
    const root = new THREE.Group();
    root.position.set(-1.5, 0.75, 2.2);
    root.rotation.set(0.15, 0.4, 0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.2, 1.8, 12, 1), new THREE.MeshBasicMaterial());
    mesh.position.set(2.1, -0.4, -1.3);
    mesh.rotation.set(0.3, 0.2, 0.45);
    root.add(mesh);

    const positions = extractTransformedModelPositions(root);
    expect(positions).toBeDefined();
    expect(positions!.length).toBeGreaterThan(0);

    const actualBox = toBoxFromPositions(positions!);
    root.updateWorldMatrix(true, true);
    const expectedGeometry = (mesh.geometry as THREE.BufferGeometry).clone();
    expectedGeometry.applyMatrix4(mesh.matrixWorld);
    const expectedPosition = expectedGeometry.getAttribute("position") as THREE.BufferAttribute;
    const expectedBox = new THREE.Box3().setFromBufferAttribute(expectedPosition);
    expectBoxClose(actualBox, expectedBox);

    const localPosition = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const localBox = new THREE.Box3().setFromBufferAttribute(localPosition);
    const localCenter = localBox.getCenter(new THREE.Vector3());
    const actualCenter = actualBox.getCenter(new THREE.Vector3());
    expect(actualCenter.distanceTo(localCenter)).toBeGreaterThan(0.5);

    expectedGeometry.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it("builds hard edges from transformed mesh geometry instead of a box proxy", () => {
    const root = new THREE.Group();
    root.position.set(1.8, -0.5, 0.9);
    root.rotation.set(0.2, -0.35, 0.1);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.7, 17, 1), new THREE.MeshBasicMaterial());
    mesh.position.set(-0.7, 1.2, -0.4);
    mesh.rotation.set(0.4, 0.25, -0.15);
    root.add(mesh);

    const transformedGeometries = collectTransformedMeshGeometries(root);
    expect(transformedGeometries).toHaveLength(1);

    const transformed = transformedGeometries[0];
    const edges = new THREE.EdgesGeometry(transformed, 30);
    const edgePositions = edges.getAttribute("position") as THREE.BufferAttribute;

    // A plain box proxy produces 24 edge vertices; the cone should produce many more.
    expect(edgePositions.count).toBeGreaterThan(24);

    const edgeBox = new THREE.Box3().setFromBufferAttribute(edgePositions);
    const transformedPositions = transformed.getAttribute("position") as THREE.BufferAttribute;
    const transformedBox = new THREE.Box3().setFromBufferAttribute(transformedPositions);
    const edgeCenter = edgeBox.getCenter(new THREE.Vector3());
    expect(transformedBox.distanceToPoint(edgeCenter)).toBe(0);

    const localPosition = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const localBox = new THREE.Box3().setFromBufferAttribute(localPosition);
    const localCenter = localBox.getCenter(new THREE.Vector3());
    expect(edgeCenter.distanceTo(localCenter)).toBeGreaterThan(0.5);

    edges.dispose();
    transformed.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
