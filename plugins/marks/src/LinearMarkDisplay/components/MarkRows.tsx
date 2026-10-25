import {
  FILLED_ROW_SEPARATOR_OPACITY,
  RowSeparatorLines,
  RowsPanel,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/**
 * The rows' labels and dendrogram over the plot's rows, the lines between
 * them where `axis.grid` asks, and the scrollbar reaching the rows a pinned
 * `rowHeight` pushes past the plot's foot. The lines come first, so the
 * tree's panel paints over them.
 */
const MarkRows = observer(function MarkRows({
  model,
}: {
  model: MarkDisplayModel
}) {
  if (!model.drawsRows) {
    return null
  }
  const { yTop, plotHeight } = model.plotBox
  return (
    <>
      {model.showRowSeparators ? (
        <svg
          style={{
            position: 'absolute',
            top: yTop,
            left: 0,
            width: model.canvasWidthPx,
            height: plotHeight,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <RowSeparatorLines
            numRows={model.nrow}
            rowHeight={model.effectiveRowHeight}
            width={model.canvasWidthPx}
            opacity={FILLED_ROW_SEPARATOR_OPACITY}
            scrollTop={model.scrollTop}
            viewportHeight={plotHeight}
          />
        </svg>
      ) : null}
      <RowsPanel model={model} testIdPrefix="mark" />
    </>
  )
})

export default MarkRows
