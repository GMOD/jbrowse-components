import React from 'react'

import AddIcon from '@mui/icons-material/Add'
import { readConfObject } from '@jbrowse/core/configuration'
import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, DialogActions, DialogContent, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { DataGrid } from '@mui/x-data-grid'

const AssemblyTable = observer(function ({
  rootModel,
  setAssemblyBeingEdited,
  setAddAssemblyFormOpen,
  onClose,
}: {
  rootModel: {
    jbrowse: {
      removeAssemblyConf: (arg: string) => void
      assemblies: AnyConfigurationModel[]
    }
  }
  setAssemblyBeingEdited: (arg: AnyConfigurationModel) => void
  setAddAssemblyFormOpen: (arg: boolean) => void
  onClose: () => void
}) {
  return (
    <>
      <DialogContent>
        <DataGrid
          rowHeight={25}
          columnHeaderHeight={35}
          hideFooter={rootModel.jbrowse.assemblies.length < 25}
          rows={rootModel.jbrowse.assemblies.map(assembly => {
            return {
              id: readConfObject(assembly, 'name'),
              name: readConfObject(assembly, 'name'),
              displayName: readConfObject(assembly, 'displayName'),
              aliases: readConfObject(assembly, 'aliases'),
              assembly,
            }
          })}
          columns={[
            { field: 'name' },
            { field: 'displayName' },
            { field: 'aliases' },
            {
              field: 'actions',
              renderCell: params => {
                return (
                  <>
                    <IconButton
                      onClick={() => {
                        setAssemblyBeingEdited(params.row.assembly)
                      }}
                    >
                      <CreateIcon color="primary" />
                    </IconButton>
                    <IconButton
                      onClick={() => {
                        rootModel.jbrowse.removeAssemblyConf(params.row.name)
                      }}
                    >
                      <DeleteIcon color="error" />
                    </IconButton>
                  </>
                )
              },
            },
          ]}
        />
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
            setAddAssemblyFormOpen(true)
          }}
        >
          Add new assembly
        </Button>
      </DialogActions>
    </>
  )
})

export default AssemblyTable
