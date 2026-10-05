import { RowSeparatorLines } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { SEPARATOR_OPACITY } from '../constants.ts'

import type { VariantRowsModel } from './types.ts'

// The lines between rows, drawn in the rows panel over the canvas. On-screen
// counterpart of the separators `SvgVariantOverlay` draws in the export.
const VariantRowSeparators = observer(function VariantRowSeparators({
  model,
}: {
  model: VariantRowsModel
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
    <svg
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
      />
    </svg>
  ) : null
})

export default VariantRowSeparators
