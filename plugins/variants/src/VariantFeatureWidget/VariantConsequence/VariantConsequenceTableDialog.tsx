import { Dialog } from '@jbrowse/core/ui'
import DetailTable from '@jbrowse/core/ui/DetailTable'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

interface ConsequenceRow {
  id: number
  record: Record<string, string>
}

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
    const rows = records.map((record, id) => ({ id, record }))
    const columns = fields.map(
      field =>
        ({
          field,
          value: row => row.record[field],
        }) satisfies DetailTableColumn<ConsequenceRow>,
    )
    return (
      <Dialog
        open
        fullWidth
        maxWidth="xl"
        title={title}
        onClose={() => {
          onClose()
        }}
      >
        <DialogContent>
          <DetailTable
            exportName={title}
            testId="variant-consequence-table"
            rows={rows}
            columns={columns}
            maxHeight={600}
          />
        </DialogContent>
      </Dialog>
    )
  },
)

export default VariantConsequenceTableDialog
