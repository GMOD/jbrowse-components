// Stable 32-bit hash of an MST node id. Used as the backend region key so
// many displays can share one backend without coordinating integer slots.
// Collisions are vanishingly rare for display cardinalities in practice.
export function syntenyDisplayKey(id: string) {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  return h >>> 0
}
