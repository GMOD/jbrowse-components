import {
  RowLabelsOverlay,
  RowSeparatorLines,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { SEPARATOR_OPACITY } from '../constants.ts'

import type { VariantRowsModel } from './types.ts'

// What the multi-sample variant display floats over its canvas: the row
// labels and the row separators. On-screen counterpart of `SvgVariantOverlay`,
// which composes the same two for the export, the labels through
// `SvgTreeSidebar`. The color key is the chrome's, off `colorScales`.
//
// The labels are tree-sidebar's `RowLabelsOverlay`, the same one the other
// row displays mount, each with its `rowColor` bar.
const MultiSampleVariantOverlay = observer(function MultiSampleVariantOverlay({
  model,
  top = 0,
}: {
  model: VariantRowsModel
  top?: number
}) {
  const {
    availableHeight,
    showRowLabels,
    showRowSeparators,
    sources,
    rowBands,
    effectiveRowHeight,
    scrollTop,
    canvasWidthPx,
  } = model
  return (
    <>
      {showRowSeparators ? (
        <svg
          style={{
            position: 'absolute',
            top,
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
      ) : null}
      <RowLabelsOverlay
        testId="variant-row-labels"
        sources={sources}
        rowHeight={effectiveRowHeight}
        labelOffset={treeSidebarOffset(model)}
        width={canvasWidthPx}
        height={availableHeight}
        top={top}
        scrollTop={scrollTop}
        showLabels={showRowLabels}
        bands={rowBands}
      />
    </>
  )
})

export default MultiSampleVariantOverlay
