import { max } from 'd3-array'

import type { NodeWithIds } from './types'
import type { HierarchyNode } from 'd3-hierarchy'

// basically same as maxLength from https://observablehq.com/@d3/tree-of-life
export function maxLength(d: HierarchyNode<NodeWithIds>): number {
  return (
    (d.data.length || 0) + (d.children ? max(d.children, maxLength) || 0 : 0)
  )
}

// basically same as setRadius from https://observablehq.com/@d3/tree-of-life
export function setBrLength(
  d: HierarchyNode<NodeWithIds>,
  y0: number,
  k: number,
) {
  // @ts-expect-error
  d.len = (y0 += Math.max(d.data.length || 0, 0)) * k

  if (d.children) {
    d.children.forEach(d => {
      setBrLength(d, y0, k)
    })
  }
}
