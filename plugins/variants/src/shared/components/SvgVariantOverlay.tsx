import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'
import type React from 'react'

const SvgVariantOverlay = ({
  id,
  width,
  height,
  content,
  sources,
  rowHeight,
  scrollTop,
  availableHeight,
  canDisplayLabels,
  hierarchy,
  showTree,
  treeAreaWidth,
}: {
  id: string
  width: number
  height: number
  content: React.ReactNode
  sources: { name: string }[]
  rowHeight: number
  scrollTop: number
  availableHeight: number
  canDisplayLabels: boolean
  hierarchy: ClusterHierarchyNode | undefined
  showTree: boolean
  treeAreaWidth: number
}) => {
  return (
    <SvgClipRect id={id} width={width} height={height}>
      {content}
      <SvgTreeSidebar
        showTree={showTree}
        hierarchy={hierarchy}
        sources={sources}
        rowHeight={rowHeight}
        treeAreaWidth={treeAreaWidth}
        showLabels={sources.length > 1 && canDisplayLabels}
        scrollTop={scrollTop}
        availableHeight={availableHeight}
      />
    </SvgClipRect>
  )
}

export default SvgVariantOverlay
