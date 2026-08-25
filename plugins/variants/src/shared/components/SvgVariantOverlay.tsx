import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { SEPARATOR_OPACITY } from '../constants.ts'
import SvgVariantLegend from './SvgVariantLegend.tsx'

import type { RenderSvgBaseModel } from '../renderSvgUtils.ts'
import type React from 'react'

// The frame both multi-sample variant SVG exports end in: the display-band clip,
// the row content, the tree/label sidebar, and the color key. Row content and
// sidebar are translated below `rowsTopOffset` together — the same offset the
// on-screen canvas and `TreeSidebar` take — so a display with bands above its
// rows can't export its rows 20px high while its labels stay put. `variantLane`
// and `lineZone` draw in those bands (the variant strip, and the matrix
// display's connector lines, in that stacking order — see
// shared/variantTopBands.ts); the legend floats over the whole band, as it does
// on screen.
//
// The sidebar is `SvgTreeSidebar` with its default labels, the same
// `SvgRowLabels` the other row displays export — tinted by `labelColor`, the
// channel the on-screen `RowLabelsOverlay` reads too.
const SvgVariantOverlay = ({
  model,
  idPrefix,
  width,
  height,
  variantLane,
  lineZone,
  insertionColor,
  children,
}: {
  model: RenderSvgBaseModel
  idPrefix: string
  width: number
  height: number
  // The variant lane's own painted band, from the display that draws one.
  // Untranslated: it sits at the top of the display, above `lineZone`.
  variantLane?: React.ReactNode
  lineZone?: React.ReactNode
  // The export theme's `palette.insertion`, from the display that draws
  // insertion markers, so the key matches the glyphs this same export painted
  // rather than the live session's palette. Omitted by the matrix display,
  // which draws no markers.
  insertionColor?: string
  children: React.ReactNode
}) => {
  const {
    sources,
    effectiveRowHeight: rowHeight,
    scrollTop,
    hierarchy,
    showTree,
    showLegend,
    showRowLabels,
    showRowSeparators,
    availableHeight,
    treeAreaWidth,
    rowsTopOffset,
  } = model
  return (
    <SvgClipRect
      id={`${idPrefix}-${svgNodeId(model)}`}
      width={width}
      height={height}
    >
      {variantLane}
      {lineZone}
      <g transform={`translate(0 ${rowsTopOffset})`}>
        {children}
        {showRowSeparators ? (
          <RowSeparatorLines
            numRows={sources.length}
            rowHeight={rowHeight}
            width={width}
            opacity={SEPARATOR_OPACITY}
            scrollTop={scrollTop}
            viewportHeight={availableHeight}
          />
        ) : null}
        <SvgTreeSidebar
          showTree={showTree}
          hierarchy={hierarchy}
          sources={sources}
          rowHeight={rowHeight}
          treeAreaWidth={treeAreaWidth}
          showLabels={showRowLabels}
          scrollTop={scrollTop}
          availableHeight={availableHeight}
          clusterProvenance={model.clusterProvenance}
        />
      </g>
      {showLegend ? (
        <SvgVariantLegend
          sections={model.legendSections(insertionColor)}
          canvasWidth={width}
          maxHeight={height}
        />
      ) : null}
    </SvgClipRect>
  )
}

export default SvgVariantOverlay
