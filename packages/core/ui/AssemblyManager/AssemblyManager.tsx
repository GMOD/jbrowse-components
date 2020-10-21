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

// Add Form imports
import TextField from '@material-ui/core/TextField'
import { IconButton } from '@material-ui/core'
import { ConfigurationEditor } from '../configEditor'

import AssemblyTable from './AssemblyTable'

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

const AssemblyAddForm = observer(
  ({ setFormOpen }: { setFormOpen: Function }) => {
    return (
      <>
        <form noValidate autoComplete="off">
          <TextField
            id="assembly-name"
            label="Assembly Name"
            variant="outlined"
          />
          <TextField id="aliases" label="Aliases" variant="outlined" />
        </form>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setFormOpen(false)}
        >
          Close
        </Button>
      </>
    )
  },
)

const AssemblyEditor = observer(
  ({
    assembly,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assembly: any
  }) => {
    return <ConfigurationEditor target={assembly} />
  },
)

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
            {isFormOpen ? <AssemblyAddForm setFormOpen={setFormOpen} /> : null}
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
