import { RowsPanel, treeSidebarOffset } from '@jbrowse/tree-sidebar'
import { rowLabelOffset } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/**
 * The rows' labels and dendrogram over the plot's rows, and the scrollbar
 * reaching the rows a pinned `rowHeight` pushes past the plot's foot.
 */
const MarkRows = observer(function MarkRows({
  model,
}: {
  model: MarkDisplayModel
}) {
  return model.drawsKeyedRows ? (
    <RowsPanel
      model={model}
      testIdPrefix="mark"
      labelOffset={rowLabelOffset(model.axes, treeSidebarOffset(model))}
    />
  ) : null
})

export default MarkRows
