import {
  RowLabelsOverlay,
  TreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { rowLabelOffset } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/** The rows' labels and dendrogram, over the plot's rows. */
const MarkRows = observer(function MarkRows({
  model,
  yTop,
  plotHeight,
}: {
  model: MarkDisplayModel
  yTop: number
  plotHeight: number
}) {
  return model.drawsRows ? (
    <>
      <RowLabelsOverlay
        testId="mark-row-labels"
        sources={model.sources}
        rowHeight={model.effectiveRowHeight}
        labelOffset={rowLabelOffset(model.axes, treeSidebarOffset(model))}
        width={model.canvasWidthPx}
        height={plotHeight}
        top={yTop}
        showLabels={model.showRowLabels}
      />
      <TreeSidebar model={model} />
    </>
  ) : null
})

export default MarkRows
