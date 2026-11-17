import { readConfObject } from '@jbrowse/core/configuration'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import AddIcon from '@mui/icons-material/Add'
import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  DialogActions,
  DialogContent,
  IconButton,
  Tooltip,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { AssemblyManagerSession } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const lockedReason =
  "This assembly comes from the server's configuration, so only the site admin can change it"

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
  return (
    <>
      <DialogContent>
        <DataGridFlexContainer>
          <DataGrid
            rowHeight={25}
            columnHeaderHeight={35}
            hideFooter={session.assemblies.length < 25}
            rows={session.assemblies.map(assembly => ({
              id: readConfObject(assembly, 'name'),
              name: readConfObject(assembly, 'name'),
              displayName: readConfObject(assembly, 'displayName'),
              aliases: readConfObject(assembly, 'aliases'),
              assembly,
            }))}
            columns={[
              { field: 'name' },
              { field: 'displayName' },
              { field: 'aliases' },
              {
                field: 'actions',
                renderCell: ({ row }) => {
                  const { assembly, name } = row
                  const editable = session.canEditAssembly(name)
                  return (
                    <>
                      <Tooltip title={editable ? '' : lockedReason}>
                        <span>
                          <IconButton
                            data-testid={`${name}-edit`}
                            disabled={!editable}
                            onClick={() => {
                              onEditAssembly(assembly)
                            }}
                          >
                            <CreateIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={editable ? '' : lockedReason}>
                        <span>
                          <IconButton
                            data-testid={`${name}-delete`}
                            disabled={!editable}
                            onClick={() => {
                              session.removeAssembly(name)
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )
                },
              },
            ]}
          />
        </DataGridFlexContainer>
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
