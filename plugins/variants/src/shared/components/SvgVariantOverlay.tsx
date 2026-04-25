import type React from 'react'

import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'

import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

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
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0
  return (
    <SvgClipRect id={id} width={width} height={height}>
      {content}
      {sources.length > 1 && canDisplayLabels ? (
        <SvgRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={labelOffset}
          scrollTop={scrollTop}
          availableHeight={availableHeight}
        />
      ) : null}
      {showTree && hierarchy ? (
        <SvgTreePath hierarchy={hierarchy} scrollTop={scrollTop} />
      ) : null}
    </SvgClipRect>
  )
}

export default SvgVariantOverlay
