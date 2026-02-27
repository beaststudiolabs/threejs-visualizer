import * as THREE from "three";

type PositionAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

const getPositionAttribute = (geometry: THREE.BufferGeometry): PositionAttribute | undefined => {
  const attribute = geometry.getAttribute("position");
  if (!attribute || attribute.itemSize < 3 || attribute.count === 0) {
    return undefined;
  }
  return attribute as PositionAttribute;
};

const disposeGeometries = (geometries: THREE.BufferGeometry[]): void => {
  for (const geometry of geometries) {
    geometry.dispose();
  }
};

export const collectTransformedMeshGeometries = (model?: THREE.Object3D): THREE.BufferGeometry[] => {
  if (!model) {
    return [];
  }

  model.updateWorldMatrix(true, true);

  const geometries: THREE.BufferGeometry[] = [];

  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) {
      return;
    }

    const sourceGeometry = mesh.geometry as THREE.BufferGeometry;
    if (!getPositionAttribute(sourceGeometry)) {
      return;
    }

    const geometry = sourceGeometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometries.push(geometry);
  });

  return geometries;
};

export const extractTransformedModelPositions = (model?: THREE.Object3D): Float32Array | undefined => {
  const geometries = collectTransformedMeshGeometries(model);
  if (geometries.length === 0) {
    return undefined;
  }

  let valueCount = 0;
  for (const geometry of geometries) {
    const position = getPositionAttribute(geometry);
    if (!position) continue;
    valueCount += position.count * 3;
  }

  if (valueCount === 0) {
    disposeGeometries(geometries);
    return undefined;
  }

  const positions = new Float32Array(valueCount);
  let writeIndex = 0;

  for (const geometry of geometries) {
    const position = getPositionAttribute(geometry);
    if (!position) {
      geometry.dispose();
      continue;
    }

    for (let i = 0; i < position.count; i += 1) {
      positions[writeIndex] = position.getX(i);
      positions[writeIndex + 1] = position.getY(i);
      positions[writeIndex + 2] = position.getZ(i);
      writeIndex += 3;
    }

    geometry.dispose();
  }

  return positions;
};
