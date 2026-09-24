import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import { renderTreeSVG, treeStroke } from './hierarchy.ts'

import type { ClusterHierarchyNode } from './types.ts'

export function SvgTreePath({
  hierarchy,
  scrollTop = 0,
}: {
  hierarchy: ClusterHierarchyNode
  scrollTop?: number
}) {
  const palette = usePalette()
  return (
    <g transform={`translate(0 ${-scrollTop})`}>
      <path
        d={renderTreeSVG(hierarchy)}
        fill="none"
        stroke={treeStroke(palette)}
        strokeWidth={1}
      />
    </g>
  )
}
