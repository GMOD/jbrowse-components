import { readConfObject } from '@jbrowse/core/configuration'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import AddIcon from '@mui/icons-material/Add'
import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, DialogActions, DialogContent, IconButton } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const AssemblyTable = observer(function ({
  onEditAssembly,
  onAddAssembly,
  onClose,
  session,
}: {
  onEditAssembly: (arg: AnyConfigurationModel) => void
  onAddAssembly: () => void
  onClose: () => void
  session: AbstractSessionModel
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
                  // @ts-expect-error
                  const editable = session.sessionAssemblies.includes(assembly)
                    ? true
                    : session.adminMode
                  return (
                    <>
                      <IconButton
                        disabled={!editable}
                        onClick={() => {
                          onEditAssembly(assembly)
                        }}
                      >
                        <CreateIcon />
                      </IconButton>
                      <IconButton
                        data-testid={`${name}-delete`}
                        disabled={!editable}
                        onClick={() => {
                          if (editable) {
                            if (!session.removeAssembly) {
                              session.notify(
                                'Unable to find removeAssembly function',
                              )
                            } else {
                              session.removeAssembly(name)
                            }
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
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
