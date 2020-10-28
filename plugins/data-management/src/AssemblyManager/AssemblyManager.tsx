import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import AddIcon from '@material-ui/icons/Add'
import ArrowBackIosIcon from '@material-ui/icons/ArrowBackIos'
import { IconButton } from '@material-ui/core/'

import AssemblyTable from './AssemblyTable'
import AssemblyAddForm from './AssemblyAddForm'
import AssemblyEditor from './AssemblyEditor'

const useStyles = makeStyles(() => ({
  titleBox: {
    color: '#FFFFFF',
    backgroundColor: '#0D233F',
    textAlign: 'center',
  },
  dialogContent: {
    width: 600,
  },
  backButton: {
    color: '#FFFFFF',
  },
}))

const AssemblyManager = observer(
  ({
    rootModel,
    open,
    onClose,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModel: any
    open: boolean
    onClose: Function
  }) => {
    const classes = useStyles()
    const [isFormOpen, setFormOpen] = useState(false)
    const [isAssemblyBeingEdited, setIsAssemblyBeingEdited] = useState(false)
    const [assemblyBeingEdited, setAssemblyBeingEdited] = useState()

    const showAssemblyTable = !isFormOpen && !isAssemblyBeingEdited

    return (
      <Dialog open={open}>
        <DialogTitle className={classes.titleBox}>
          {showAssemblyTable ? <p>Assembly Manager</p> : null}
          {isFormOpen ? (
            <>
              <div style={{ textAlign: 'left' }}>
                <IconButton
                  aria-label="back"
                  className={classes.backButton}
                  onClick={() => setFormOpen(false)}
                >
                  <ArrowBackIosIcon />
                </IconButton>
              </div>
              <p>Add New Assembly</p>
            </>
          ) : null}
          {isAssemblyBeingEdited ? (
            <>
              <div style={{ textAlign: 'left' }}>
                <IconButton
                  aria-label="back"
                  className={classes.backButton}
                  onClick={() => setIsAssemblyBeingEdited(false)}
                >
                  <ArrowBackIosIcon />
                </IconButton>
              </div>
              <p>{returnAssemblyName(assemblyBeingEdited)}</p>
            </>
          ) : null}
        </DialogTitle>
        <DialogContent>
          <div className={classes.dialogContent}>
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
              <AssemblyAddForm
                rootModel={rootModel}
                setFormOpen={setFormOpen}
                setIsAssemblyBeingEdited={setIsAssemblyBeingEdited}
                setAssemblyBeingEdited={setAssemblyBeingEdited}
              />
            ) : null}
          </div>
        </DialogContent>
        <DialogActions>
          {showAssemblyTable ? (
            <>
              <Button
                color="secondary"
                variant="contained"
                onClick={() => {
                  onClose(false)
                }}
              >
                Return
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                onClick={() => {
                  setFormOpen(true)
                }}
              >
                Add New Assembly
              </Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>
    )
  },
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function returnAssemblyName(assembly: any) {
  if (assembly !== undefined) {
    return assembly.name
  }
  return null
}

export default AssemblyManager
