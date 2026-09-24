import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { Source } from '../../util.ts'
import type {
  ColorColumn,
  IdentityChannel,
  TreeLayoutModel,
} from '@jbrowse/tree-sidebar'

const COLUMN: Record<IdentityChannel, ColorColumn<Source>> = {
  color: {
    field: 'color',
    headerName: 'Color',
    bulkLabel: 'Change color of selected',
  },
  labelColor: {
    field: 'labelColor',
    headerName: 'Color',
    bulkLabel: 'Change color of selected',
  },
}

// The channel the mode does not edit still rides on the rows, from the adapter
// or from an earlier sitting in the other mode; reserved so the grid neither
// offers it as a raw hex column.
const RESERVED = new Set(['color', 'labelColor'])

export default observer(function WiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source> & { identityChannel: IdentityChannel }
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Wiggle color/arrangement editor"
      colorColumns={[COLUMN[model.identityChannel]]}
      reservedFields={RESERVED}
      enableBulkEdit
    />
  )
})
