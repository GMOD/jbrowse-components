import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'
import CreateIcon from '@material-ui/icons/Create'
import DeleteIcon from '@material-ui/icons/Delete'

// local
import { readConfObject } from '../../configuration'

const useStyles = makeStyles(() => ({
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
    setIsAssemblyBeingEdited,
    setAssemblyBeingEdited,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModel: any
    setIsAssemblyBeingEdited(arg: boolean): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAssemblyBeingEdited(arg: any): void
  }) => {
    const classes = useStyles()

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
              onClick={() => {
                setIsAssemblyBeingEdited(true)
                setAssemblyBeingEdited(assembly)
              }}
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

export default AssemblyTable
