import { backingScale } from '@jbrowse/render-core/canvas2dUtils'
import { RowSeparatorBoxes } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { SEPARATOR_OPACITY } from '../../shared/constants.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

// The lines between rows, drawn in the rows panel over the canvas. On-screen
// counterpart of the separators `SvgVariantOverlay` draws in the export.
const VariantRowSeparators = observer(function VariantRowSeparators({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const {
    availableHeight,
    showRowSeparators,
    sources,
    effectiveRowHeight,
    scrollTop,
    canvasWidthPx,
  } = model
  return showRowSeparators ? (
    <div
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
      <RowSeparatorBoxes
        numRows={sources.length}
        rowHeight={effectiveRowHeight}
        width={canvasWidthPx}
        opacity={SEPARATOR_OPACITY}
        scrollTop={scrollTop}
        viewportHeight={availableHeight}
        dpr={backingScale(availableHeight)}
      />
    </div>
  ) : null
})

export default VariantRowSeparators
