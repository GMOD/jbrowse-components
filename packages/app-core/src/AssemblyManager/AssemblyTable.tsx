import { readConfObject } from '@jbrowse/core/configuration'
import DetailTable from '@jbrowse/core/ui/DetailTable'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, DialogActions, DialogContent, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { AssemblyManagerSession } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

interface AssemblyRow {
  id: string
  name: string
  displayName: string
  aliases: string[]
  assembly: AnyConfigurationModel
}

const useStyles = makeStyles()({
  button: {
    padding: 0,
  },
})

const AssemblyTable = observer(function AssemblyTable({
  onEditAssembly,
  onAddAssembly,
  onClose,
  session,
}: {
  onEditAssembly: (arg: AnyConfigurationModel) => void
  onAddAssembly: () => void
  onClose: () => void
  session: AssemblyManagerSession
}) {
  const { classes } = useStyles()
  const rows = session.assemblies.map((assembly): AssemblyRow => ({
    id: readConfObject(assembly, 'name'),
    name: readConfObject(assembly, 'name'),
    displayName: readConfObject(assembly, 'displayName'),
    aliases: readConfObject(assembly, 'aliases'),
    assembly,
  }))
  const columns: DetailTableColumn<AssemblyRow>[] = [
    { field: 'name', value: row => row.name },
    { field: 'displayName', value: row => row.displayName },
    { field: 'aliases', value: row => row.aliases.join(', ') },
    {
      field: 'source',
      value: row => (session.canEditAssembly(row.name) ? '' : 'Built-in'),
    },
    {
      field: 'actions',
      value: () => '',
      cell: ({ assembly, name }) =>
        session.canEditAssembly(name) ? (
          <>
            <IconButton
              size="small"
              className={classes.button}
              data-testid={`${name}-edit`}
              onClick={() => {
                onEditAssembly(assembly)
              }}
            >
              <CreateIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              className={classes.button}
              data-testid={`${name}-delete`}
              onClick={() => {
                session.removeAssembly(name)
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </>
        ) : null,
    },
  ]

  return (
    <>
      <DialogContent>
        <DetailTable rows={rows} columns={columns} testId="assembly-table" />
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            onAddAssembly()
          }}
        >
          Add new assembly
        </Button>
      </DialogActions>
    </>
  )
})

export default AssemblyTable
