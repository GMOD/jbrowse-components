import Flatbush from '@jbrowse/core/util/flatbush'

import { descendants } from './hierarchy.ts'

import type { ClusterHierarchyNode } from './types.ts'

const HIT_RADIUS = 8

// Accepts an undefined hierarchy (returning undefined) so every consumer's
// `spatialIndex` getter is a single `buildSpatialIndex(self.hierarchy)` call
// rather than repeating the same `hierarchy ? … : undefined` guard.
export function buildSpatialIndex(hierarchy: ClusterHierarchyNode | undefined) {
  if (!hierarchy) {
    return undefined
  }
  const nodes = descendants(hierarchy).filter(n => n.children?.length)
  if (!nodes.length) {
    return undefined
  }
  const index = new Flatbush(nodes.length)
  for (const node of nodes) {
    // node.y = tree depth → canvas horizontal; node.x = row → canvas vertical
    index.add(
      node.y - HIT_RADIUS,
      node.x - HIT_RADIUS,
      node.y + HIT_RADIUS,
      node.x + HIT_RADIUS,
    )
  }
  index.finish()
  return { index, nodes }
}
