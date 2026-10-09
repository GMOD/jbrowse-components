import { RowsPanel } from '@jbrowse/tree-sidebar'
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
    <RowsPanel model={model} testIdPrefix="mark" />
  ) : null
})

export default MarkRows
