import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { SEPARATOR_OPACITY } from '../constants.ts'

import type { RenderSvgBaseModel } from '../renderSvgUtils.ts'
import type { ClusterProvenanceRegion } from '@jbrowse/tree-sidebar'
import type React from 'react'

// The frame both multi-sample variant SVG exports end in: the row content and
// the tree/label sidebar, inside the export shell's clip. Row content and sidebar are
// translated below `rowsTopOffset` together — the same offset the on-screen
// canvas and `TreeSidebar` take — so a display with bands above its rows can't
// export its rows 20px high while its labels stay put. `variantLane` and
// `lineZone` draw in those bands (the variant strip, and the matrix display's
// connector lines, in that stacking order — see shared/variantTopBands.ts).
// The color key is the export shell's, off the same `colorScales` the screen
// keys by.
//
// The sidebar is `SvgTreeSidebar` with its default labels, the same
// `SvgRowLabels` the other row displays export — tinted by `labelColor`, the
// channel the on-screen `RowLabelsOverlay` reads too.
const SvgVariantOverlay = ({
  model,
  width,
  contentBlocks,
  overlays,
  variantLane,
  lineZone,
  children,
}: {
  model: RenderSvgBaseModel
  width: number
  contentBlocks: readonly ClusterProvenanceRegion[]
  // false for a reader that samples only the display's canvas: the lane, the
  // connector zone, the separators and the sidebar are all drawn over it
  overlays: boolean
  // The variant lane's own painted band, from the display that draws one.
  // Untranslated: it sits at the top of the display, above `lineZone`.
  variantLane?: React.ReactNode
  lineZone?: React.ReactNode
  children: React.ReactNode
}) => {
  const {
    sources,
    effectiveRowHeight: rowHeight,
    scrollTop,
    hierarchy,
    showTree,
    showRowLabels,
    showRowSeparators,
    availableHeight,
    treeAreaWidth,
    rowsTopOffset,
  } = model
  return (
    <>
      {overlays ? variantLane : null}
      {overlays ? lineZone : null}
      <g transform={`translate(0 ${rowsTopOffset})`}>
        {children}
        {overlays && showRowSeparators ? (
          <RowSeparatorLines
            numRows={sources.length}
            rowHeight={rowHeight}
            width={width}
            opacity={SEPARATOR_OPACITY}
            scrollTop={scrollTop}
            viewportHeight={availableHeight}
          />
        ) : null}
        {overlays ? (
          <SvgTreeSidebar
            showTree={showTree}
            hierarchy={hierarchy}
            sources={sources}
            rowHeight={rowHeight}
            treeAreaWidth={treeAreaWidth}
            showLabels={showRowLabels}
            scrollTop={scrollTop}
            availableHeight={availableHeight}
            clusterProvenance={model.rowTreeProvenance}
            contentBlocks={contentBlocks}
          />
        ) : null}
      </g>
    </>
  )
}

export default SvgVariantOverlay
