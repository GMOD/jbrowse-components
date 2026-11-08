import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { exportedY } from '@jbrowse/display-kit/renderDisplaySvg'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { SEPARATOR_OPACITY } from '../../shared/constants.ts'

import type { RenderSvgBaseModel } from '../renderSvgUtils.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'
import type React from 'react'

// The frame both variant layouts' SVG exports end in: the row content and
// the tree/label sidebar, inside the export shell's clip. Row content and sidebar are
// translated together to `rowsTopOffset` as the export draws it (`exportedY`,
// less the lines holding only controls), so a display with bands above its rows
// can't export its rows 20px high while its labels stay put. `records` and
// `connectors` draw in those bands, in that stacking order (variantTopBands.ts).
// The color key is the export shell's, off the same `colorScales` the screen
// keys by.
//
// The sidebar is `SvgTreeSidebar` with its default labels, the same
// `SvgRowLabels` the other row displays export, as the on-screen
// `RowLabelsOverlay` draws it.
const SvgVariantOverlay = ({
  model,
  width,
  overlays,
  text,
  records,
  connectors,
  children,
}: {
  model: RenderSvgBaseModel
  width: number
  // false for a reader that samples only the display's canvas: the records
  // band over rows, the connector zone, the separators and the sidebar are
  // drawn over it. A records-only display's band is that canvas, so it is
  // drawn either way
  overlays: boolean
  text?: ExportTextStyle
  // each drawn from its band's top
  records?: React.ReactNode
  connectors?: React.ReactNode
  children: React.ReactNode
}) => {
  const {
    sources,
    effectiveRowHeight: rowHeight,
    scrollTop,
    showRowSeparators,
    availableHeight,
    rowsTopOffset,
  } = model
  return (
    <>
      {overlays || model.recordsOnly ? records : null}
      {overlays && connectors ? (
        <g
          transform={`translate(0 ${exportedY(model, model.topBands.top.connectors)})`}
        >
          {connectors}
        </g>
      ) : null}
      <g transform={`translate(0 ${exportedY(model, rowsTopOffset)})`}>
        {children}
        {overlays && showRowSeparators ? (
          <RowSeparatorLines
            numRows={sources.length}
            rowHeight={rowHeight}
            width={width}
            opacity={SEPARATOR_OPACITY}
            scrollTop={scrollTop}
            viewportHeight={availableHeight}
            dpr={1}
          />
        ) : null}
        {overlays ? (
          <SvgTreeSidebar
            sidebar={model.svgSidebar}
            text={text}
            scrollTop={scrollTop}
            availableHeight={availableHeight}
            clipId={svgNodeId(model)}
          />
        ) : null}
      </g>
    </>
  )
}

export default SvgVariantOverlay
