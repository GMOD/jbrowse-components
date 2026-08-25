import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { SEPARATOR_OPACITY } from '../constants.ts'
import SvgSampleRowLabelGutter from './SvgSampleRowLabelGutter.tsx'
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
// The sidebar labels are `SvgSampleRowLabelGutter`, the very component the
// on-screen overlay renders, rather than `SvgTreeSidebar`'s default
// `SvgRowLabels` — which knows only `labelColor` and so dropped the `color`
// swatch column a "Color by → population" track is read through. Passing it as
// SvgTreeSidebar's `labels` keeps the tree and the labels sharing one
// tree-offset gate. It self-gates on `canDisplayLabels` (drawing swatches alone
// when rows are too short to letter) and on its own source count, so unlike the
// default path there's no row-count gate here — a single-sample track labels its
// one row in the export exactly as it does on screen.
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
          scrollTop={scrollTop}
          labels={<SvgSampleRowLabelGutter model={model} />}
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
