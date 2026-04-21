import { renderTreeSVG } from './hierarchy.ts'

import type { ClusterHierarchyNode } from './types.ts'

export function SvgTreePath({
  hierarchy,
  scrollTop = 0,
}: {
  hierarchy: ClusterHierarchyNode
  scrollTop?: number
}) {
  return (
    <g transform={`translate(0 ${-scrollTop})`}>
      <path
        d={renderTreeSVG(hierarchy)}
        fill="none"
        stroke="#0008"
        strokeWidth={1}
      />
    </g>
  )
}
