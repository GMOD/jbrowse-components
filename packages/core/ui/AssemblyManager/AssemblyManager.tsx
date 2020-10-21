import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import AddIcon from '@material-ui/icons/Add'

// Add Form imports
import TextField from '@material-ui/core/TextField'
import { ConfigurationEditor } from '../configEditor'

import AssemblyTable from './AssemblyTable'

const useStyles = makeStyles(() => ({
  titleBox: {
    color: '#FFFFFF',
    backgroundColor: '#0D233F',
  },
  dialogContent: {
    width: 600,
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
    return (
      <>
        <TextField>Rename field</TextField>
        <ConfigurationEditor target={assembly} />
      </>
    )
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
    const [assemblyBeingEdited, setAssemblyBeingEdited] = useState()

    const showAssemblyTable = !isFormOpen && !assemblyBeingEdited

    return (
      <Dialog open={open}>
        <DialogTitle className={classes.titleBox}>Assembly Manager</DialogTitle>
        <DialogContent>
          <div className={classes.dialogContent}>
            {showAssemblyTable ? (
              <>
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
                <AssemblyTable
                  rootModel={rootModel}
                  setAssemblyBeingEdited={setAssemblyBeingEdited}
                />
              </>
            ) : null}
            {assemblyBeingEdited ? (
              <AssemblyEditor assembly={assemblyBeingEdited} />
            ) : null}
            {isFormOpen ? <AssemblyAddForm setFormOpen={setFormOpen} /> : null}
          </div>
        </DialogContent>
        <DialogActions>
          {showAssemblyTable ? (
            <Button
              color="secondary"
              variant="contained"
              onClick={() => {
                onClose(false)
              }}
            >
              Return
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    )
  },
)

export default AssemblyManager
