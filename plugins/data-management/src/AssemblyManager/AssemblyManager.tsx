import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import Dialog from '@jbrowse/core/ui/Dialog'

// icons
import AddIcon from '@mui/icons-material/Add'

// locals
import AssemblyTable from './AssemblyTable'
import AssemblyAddForm from './AssemblyAddForm'
import AssemblyEditor from './AssemblyEditor'

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
      onClose={() => {
        onClose(false)
      }}
      title="Assembly manager"
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
