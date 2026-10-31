import { backingScale } from '@jbrowse/render-core/canvas2dUtils'
import { RowSeparatorLines } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { SEPARATOR_OPACITY } from '../../shared/constants.ts'

import type { LinearVariantDisplayModel } from '../model.ts'

// The lines between rows, drawn in the rows panel over the canvas. On-screen
// counterpart of the separators `SvgVariantOverlay` draws in the export.
//
// Drawn once `cellData` lands, the payload the cells paint from: the sample
// list arrives first, and a phased track's rows double only when the payload's
// ploidy does, so a grid off `sources` alone showed over an empty canvas and
// then jumped as the cells drew.
const VariantRowSeparators = observer(function VariantRowSeparators({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const {
    availableHeight,
    showRowSeparators,
    cellData,
    sources,
    effectiveRowHeight,
    scrollTop,
    canvasWidthPx,
  } = model
  return showRowSeparators && cellData ? (
    <svg
      data-testid="variant-row-separators"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidthPx,
        height: availableHeight,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <RowSeparatorLines
        numRows={sources.length}
        rowHeight={effectiveRowHeight}
        width={canvasWidthPx}
        opacity={SEPARATOR_OPACITY}
        scrollTop={scrollTop}
        viewportHeight={availableHeight}
        dpr={backingScale(availableHeight)}
      />
    </svg>
  ) : null
})

export default VariantRowSeparators
