import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'

// icons
import AddIcon from '@mui/icons-material/Add'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import AssemblyAddForm from './AssemblyAddForm'
import AssemblyEditor from './AssemblyEditor'
import AssemblyTable from './AssemblyTable'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const AssemblyManager = observer(function ({
  rootModel,
  onClose,
}: {
  rootModel: any
  onClose: (arg: boolean) => void
}) {
  const [isFormOpen, setFormOpen] = useState(false)
  const [isAssemblyBeingEdited, setIsAssemblyBeingEdited] = useState(false)
  const [assemblyBeingEdited, setAssemblyBeingEdited] =
    useState<AnyConfigurationModel>()

  const showAssemblyTable = !isFormOpen && !isAssemblyBeingEdited

  return (
    <Dialog
      open
      title="Assembly manager"
      onClose={() => {
        onClose(false)
      }}
    >
      <DialogContent>
        {showAssemblyTable ? (
          <AssemblyTable
            rootModel={rootModel}
            setIsAssemblyBeingEdited={setIsAssemblyBeingEdited}
            setAssemblyBeingEdited={setAssemblyBeingEdited}
          />
        ) : null}
        {isAssemblyBeingEdited ? (
          <AssemblyEditor assembly={assemblyBeingEdited} />
        ) : null}
        {isFormOpen ? (
          <AssemblyAddForm rootModel={rootModel} setFormOpen={setFormOpen} />
        ) : null}
      </DialogContent>
      <DialogActions>
        {isFormOpen ? (
          <Button
            variant="contained"
            onClick={() => {
              setFormOpen(false)
            }}
          >
            Back
          </Button>
        ) : null}
        {isAssemblyBeingEdited ? (
          <Button
            variant="contained"
            onClick={() => {
              setIsAssemblyBeingEdited(false)
            }}
          >
            Back
          </Button>
        ) : null}
        {showAssemblyTable ? (
          <>
            <Button
              color="secondary"
              variant="contained"
              onClick={() => {
                onClose(false)
              }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setFormOpen(true)
              }}
            >
              Add new assembly
            </Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  )
})

export default AssemblyManager
