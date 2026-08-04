import { useTheme } from '@mui/material'

import { renderTreeSVG, treeStroke } from './hierarchy.ts'

import type { ClusterHierarchyNode } from './types.ts'

export function SvgTreePath({
  hierarchy,
  scrollTop = 0,
}: {
  hierarchy: ClusterHierarchyNode
  scrollTop?: number
}) {
  const theme = useTheme()
  return (
    <g transform={`translate(0 ${-scrollTop})`}>
      <path
        d={renderTreeSVG(hierarchy)}
        fill="none"
        stroke={treeStroke(theme.palette)}
        strokeWidth={1}
      />
    </g>
  )
}
