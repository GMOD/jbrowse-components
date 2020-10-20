import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
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

// local
import { readConfObject } from '../configuration'

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
    setAssemblyBeingEdited: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    classes: any
  }) => {
    console.log(readConfObject(rootModel.jbrowse, 'assemblies'))
    const assemblies = readConfObject(rootModel.jbrowse, 'assemblies')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = assemblies.map((assembly: any) => {
      const { name, aliases } = assembly
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
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Aliases</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <Table>
          <TableBody>{rows}</TableBody>
        </Table>
      </TableContainer>
    )
  },
)

const AssemblyAddForm = observer(() => {
  return <h1>Hello im the assembly addform</h1>
})

const AssemblyEditor = observer(
  ({
    assembly,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assembly: any
  }) => {
    return <h1>Hello im the assembly editor for {assembly.name}</h1>
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

    const showAddNewAssemblyButton = !isFormOpen && !assemblyBeingEdited

    return (
      <Dialog open={open}>
        <DialogTitle className={classes.titleBox}>Assembly Manager</DialogTitle>
        <DialogContent>
          <div className={classes.dialogContent}>
            {showAddNewAssemblyButton ? (
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
            {isFormOpen ? <AssemblyAddForm /> : null}
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              onClose(false)
            }}
          >
            Return
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

// remember to make observable
export default AssemblyManager
