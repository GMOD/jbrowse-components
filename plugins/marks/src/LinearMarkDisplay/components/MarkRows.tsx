import { useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { useRowVirtualScroll } from '@jbrowse/core/util/useRowVirtualScroll'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import {
  RowLabelsOverlay,
  TreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { rowLabelOffset } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/**
 * The rows' labels and dendrogram over the plot's rows, and the scrollbar
 * reaching the rows a pinned `rowHeight` pushes past the plot's foot. The
 * panel holds the wheel, so a wheel over the labels or the tree scrolls the
 * rows they name.
 */
const MarkRows = observer(function MarkRows({
  model,
  yTop,
  plotHeight,
}: {
  model: MarkDisplayModel
  yTop: number
  plotHeight: number
}) {
  const rowsId = useId()
  const [rowsEl, setRowsEl] = useState<HTMLDivElement | null>(null)
  useRowVirtualScroll(rowsEl, model, containingLgv(model).scrollZoom)
  return model.drawsKeyedRows ? (
    <>
      <div
        ref={setRowsEl}
        id={rowsId}
        data-testid="mark-rows"
        style={{
          position: 'absolute',
          top: yTop,
          left: 0,
          width: model.canvasWidthPx,
          height: plotHeight,
        }}
      >
        <RowLabelsOverlay
          testId="mark-row-labels"
          sources={model.sources}
          rowHeight={model.effectiveRowHeight}
          labelOffset={rowLabelOffset(model.axes, treeSidebarOffset(model))}
          width={model.canvasWidthPx}
          height={plotHeight}
          top={yTop}
          scrollTop={model.scrollTop}
          showLabels={model.showRowLabels}
        />
        <TreeSidebar model={model} top={yTop} />
      </div>
      <ScrollChrome model={model} controlsId={rowsId} top={yTop} />
    </>
  ) : null
})

export default MarkRows
