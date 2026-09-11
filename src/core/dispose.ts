import { Mesh, type Material, type Object3D, type Texture } from 'three/webgpu';

function disposeMaterial(material: Material): void {
  // Walk every property looking for textures. Materials have a lot of possible
  // map slots and TSL node materials can carry more, so enumerating beats
  // maintaining a hardcoded list that silently goes stale.
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === 'object' && 'isTexture' in value) {
      (value as Texture).dispose();
    }
  }
  material.dispose();
}

/**
 * Deep-release everything under a subtree, then detach it.
 *
 * Only one zone is resident at a time, so this is what makes the GPU texture
 * ceiling apply per zone instead of cumulatively. An accumulating leak across
 * five transitions is the most likely way the experience dies on a phone, so
 * every zone's `dispose()` should route through here.
 */
export function disposeSubtree(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry?.dispose();
    const material = node.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
  root.removeFromParent();
  root.clear();
}
