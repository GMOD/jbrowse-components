import Flatbush from '@jbrowse/core/util/flatbush'

import { descendants } from './hierarchy.ts'

import type { ClusterHierarchyNode } from './types.ts'

const HIT_RADIUS = 8

// The tree's hit-test structure and the nodes it indexes, positionally aligned:
// `index.search` answers with positions into `nodes`, so the two only mean
// anything together and are never passed apart.
export interface TreeSpatialIndex {
  index: Flatbush
  nodes: ClusterHierarchyNode[]
}

// A dendrogram node's coordinates are SWAPPED relative to the canvas: `node.y`
// is tree depth and therefore the horizontal axis, `node.x` is the row and
// therefore the vertical one. Building the index and querying it have to agree
// about that, so they are one file and this is the only place either says it.
function nodeBox(node: ClusterHierarchyNode) {
  return {
    minX: node.y - HIT_RADIUS,
    minY: node.x - HIT_RADIUS,
    maxX: node.y + HIT_RADIUS,
    maxY: node.x + HIT_RADIUS,
  }
}

// Accepts an undefined hierarchy (returning undefined) so every consumer's
// `spatialIndex` getter is a single `buildSpatialIndex(self.hierarchy)` call
// rather than repeating the same `hierarchy ? … : undefined` guard.
//
// Internal nodes only: a leaf is one row, and "show only this subtree" over a
// single row is not an operation the menu offers.
export function buildSpatialIndex(
  hierarchy: ClusterHierarchyNode | undefined,
): TreeSpatialIndex | undefined {
  if (!hierarchy) {
    return undefined
  }
  const nodes = descendants(hierarchy).filter(n => n.children?.length)
  if (!nodes.length) {
    return undefined
  }
  const index = new Flatbush(nodes.length)
  for (const node of nodes) {
    const { minX, minY, maxX, maxY } = nodeBox(node)
    index.add(minX, minY, maxX, maxY)
  }
  index.finish()
  return { index, nodes }
}

// The node under (`x`, `y`) in canvas space, or undefined for empty tree area.
//
// Hit boxes are `HIT_RADIUS` square and a dendrogram packs parent above child,
// so several routinely overlap under one cursor position. `index.search` hands
// those back in tree order, which is arbitrary with respect to the cursor —
// picking its first match makes the hover jump to whichever node happens to be
// earlier in the traversal rather than the one being pointed at. So pick by
// distance to the node's actual center, comparing squared distances because
// only the ordering is wanted and `Math.sqrt` would not change it.
export function pickTreeNode(
  spatialIndex: TreeSpatialIndex,
  x: number,
  y: number,
) {
  const { index, nodes } = spatialIndex
  let best: ClusterHierarchyNode | undefined
  let bestDistance = Infinity
  for (const idx of index.search(x, y, x, y)) {
    const node = nodes[idx]!
    // node.y is horizontal and node.x vertical -- see `nodeBox`
    const dx = node.y - x
    const dy = node.x - y
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      best = node
    }
  }
  return best
}
