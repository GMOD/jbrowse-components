import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import type { RenderSvgBaseModel } from '../renderSvgUtils.ts'
import type React from 'react'

// The frame both multi-sample variant SVG exports end in: the display-band clip,
// the row content, and the tree/label sidebar. Row content and sidebar are
// translated below `lineZoneHeight` together — the same offset the on-screen
// canvas and `TreeSidebar` take — so a display with a connector-line zone can't
// export its rows 20px high while its labels stay put. `lineZone` draws in that
// top strip (the matrix display's connector lines).
const SvgVariantOverlay = ({
  model,
  idPrefix,
  width,
  height,
  lineZone,
  children,
}: {
  model: RenderSvgBaseModel
  idPrefix: string
  width: number
  height: number
  lineZone?: React.ReactNode
  children: React.ReactNode
}) => {
  const {
    id,
    sources,
    effectiveRowHeight: rowHeight,
    scrollTop,
    availableHeight,
    canDisplayLabels,
    hierarchy,
    showTree,
    treeAreaWidth,
    lineZoneHeight,
  } = model
  const rows = sources ?? []
  return (
    <SvgClipRect id={`${idPrefix}-${id}`} width={width} height={height}>
      {lineZone}
      <g transform={`translate(0 ${lineZoneHeight})`}>
        {children}
        <SvgTreeSidebar
          showTree={showTree}
          hierarchy={hierarchy}
          sources={rows}
          rowHeight={rowHeight}
          treeAreaWidth={treeAreaWidth}
          showLabels={rows.length > 1 && canDisplayLabels}
          scrollTop={scrollTop}
          availableHeight={availableHeight}
        />
      </g>
    </SvgClipRect>
  )
}

export default SvgVariantOverlay
