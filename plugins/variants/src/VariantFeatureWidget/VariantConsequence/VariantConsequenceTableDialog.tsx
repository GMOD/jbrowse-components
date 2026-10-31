import { Dialog } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { measuredColumns } from '../measuredColumns.ts'

const VariantConsequenceTableDialog = observer(
  function VariantConsequenceTableDialog({
    title,
    fields,
    records,
    onClose,
  }: {
    title: string
    fields: string[]
    records: Record<string, string>[]
    onClose: () => void
  }) {
    const rows = records.map((record, id) => ({ ...record, id }))
    return (
      <Dialog
        open
        maxWidth="xl"
        title={title}
        onClose={() => {
          onClose()
        }}
      >
        <DialogContent>
          <DataGrid
            rowHeight={25}
            hideFooter={rows.length < 100}
            rows={rows}
            showToolbar
            columns={measuredColumns(rows, fields)}
          />
        </DialogContent>
      </Dialog>
    )
  },
)

export default VariantConsequenceTableDialog
