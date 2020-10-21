import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'

// Table imports
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'
import AddIcon from '@material-ui/icons/Add'
import CreateIcon from '@material-ui/icons/Create'
import DeleteIcon from '@material-ui/icons/Delete'

// Add Form imports
import TextField from '@material-ui/core/TextField'
import { readConfObject } from '../../configuration'
import { ConfigurationEditor } from '../configEditor'

const useStyles = makeStyles(() => ({
  titleBox: {
    color: '#FFFFFF',
    backgroundColor: '#0D233F',
  },
  table: {
    minWidth: 650,
  },
  buttonCell: {
    padding: 3,
  },
  button: {
    display: 'inline-block',
    padding: 0,
    minHeight: 0,
    minWidth: 0,
  },

  dialogContent: {
    width: 600,
  },
}))

const AssemblyTable = observer(
  ({
    rootModel,
    setAssemblyBeingEdited,
    classes,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModel: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAssemblyBeingEdited(arg: any): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    classes: any
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = rootModel.jbrowse.assemblies.map((assembly: any) => {
      const name = readConfObject(assembly, 'name')
      const aliases = readConfObject(assembly, 'aliases')
      return (
        <TableRow key={name}>
          <TableCell>{name}</TableCell>
          <TableCell>{aliases.toString()}</TableCell>
          <TableCell className={classes.buttonCell}>
            <Button
              className={classes.button}
              onClick={() => setAssemblyBeingEdited(assembly)}
            >
              <CreateIcon color="primary" />
            </Button>
          </TableCell>
          <TableCell className={classes.buttonCell}>
            <Button className={classes.button}>
              <DeleteIcon color="error" />
            </Button>
          </TableCell>
        </TableRow>
      )
    })

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Aliases</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{rows}</TableBody>
        </Table>
      </TableContainer>
    )
  },
)

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
                  classes={classes}
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
