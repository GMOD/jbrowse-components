import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { GridColDef } from '@mui/x-data-grid'

interface GenomeSubsetModel {
  queryGenomeNames: string[]
  selectedGenomes: { length: number } & Iterable<string>
  setSelectedGenomes(genomes: string[]): void
}

interface GenomeRow {
  name: string
}

const columns: GridColDef<GenomeRow>[] = [
  {
    field: 'name',
    headerName: 'Genome',
    flex: 1,
    minWidth: 150,
  },
]

const GenomeSubsetSelector = observer(function GenomeSubsetSelector({
  model,
  handleClose,
}: {
  model: GenomeSubsetModel
  handleClose: () => void
}) {
  const allNames = model.queryGenomeNames
  const rows = allNames.map(name => ({ name }))
  const selected =
    model.selectedGenomes.length > 0
      ? new Set(model.selectedGenomes)
      : new Set(allNames)

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Select genomes to display"
      maxWidth="sm"
      fullWidth
    >
      <DialogContent>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid
            checkboxSelection
            disableRowSelectionOnClick
            rows={rows}
            columns={columns}
            getRowId={row => row.name}
            rowHeight={28}
            columnHeaderHeight={33}
            rowSelectionModel={{ type: 'include', ids: selected }}
            onRowSelectionModelChange={arg => {
              model.setSelectedGenomes(allNames.filter(n => arg.ids.has(n)))
            }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GenomeSubsetSelector
