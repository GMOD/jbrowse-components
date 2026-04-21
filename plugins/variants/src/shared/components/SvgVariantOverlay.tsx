import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'

import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

const SvgVariantOverlay = ({
  id,
  width,
  height,
  svgContent,
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
  svgContent: string
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
      <g dangerouslySetInnerHTML={{ __html: svgContent }} />
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
