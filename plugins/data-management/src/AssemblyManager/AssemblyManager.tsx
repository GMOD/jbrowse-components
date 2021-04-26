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
import CloseIcon from '@material-ui/icons/Close'
import { IconButton } from '@material-ui/core/'

import AssemblyTable from './AssemblyTable'
import AssemblyAddForm from './AssemblyAddForm'
import AssemblyEditor from './AssemblyEditor'

const useStyles = makeStyles(theme => ({
  titleBox: {
    color: '#fff',
    backgroundColor: theme.palette.primary.main,
    textAlign: 'center',
  },
  dialogContent: {
    width: '100%',
  },
  backButton: {
    color: '#fff',
    position: 'absolute',
    left: theme.spacing(4),
    top: theme.spacing(4),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
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
    onClose: (arg: boolean) => void
  }) => {
    const classes = useStyles()
    const [isFormOpen, setFormOpen] = useState(false)
    const [isAssemblyBeingEdited, setIsAssemblyBeingEdited] = useState(false)
    const [assemblyBeingEdited, setAssemblyBeingEdited] = useState()

    const showAssemblyTable = !isFormOpen && !isAssemblyBeingEdited

    return (
      <Dialog open={open} onClose={() => onClose(false)}>
        <DialogTitle className={classes.titleBox}>
          {showAssemblyTable ? 'Assembly manager' : null}
          {isFormOpen ? (
            <>
              <IconButton
                aria-label="back"
                className={classes.backButton}
                onClick={() => setFormOpen(false)}
              >
                <ArrowBackIosIcon />
              </IconButton>
              Add new assembly
            </>
          ) : null}
          {isAssemblyBeingEdited ? (
            <>
              <IconButton
                aria-label="back"
                className={classes.backButton}
                onClick={() => setIsAssemblyBeingEdited(false)}
              >
                <ArrowBackIosIcon />
              </IconButton>
              {returnAssemblyName(assemblyBeingEdited)}
            </>
          ) : null}
          <IconButton
            aria-label="close"
            className={classes.closeButton}
            onClick={() => onClose(false)}
          >
            <CloseIcon />
          </IconButton>
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
                onClick={() => onClose(false)}
              >
                Close
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                onClick={() => setFormOpen(true)}
              >
                Add new assembly
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
