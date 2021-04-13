import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { IconButton } from '@material-ui/core'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import CreateIcon from '@material-ui/icons/Create'
import DeleteIcon from '@material-ui/icons/Delete'

// local
import { readConfObject } from '@jbrowse/core/configuration'

const useStyles = makeStyles(() => ({
  table: {
    minWidth: 500,
    minHeight: 150,
  },
  buttonCell: {
    padding: 3,
  },
  button: {
    display: 'inline-block',
    padding: 3,
    minHeight: 0,
    minWidth: 0,
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

    function removeAssembly(name: string) {
      rootModel.jbrowse.removeAssemblyConf(name)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = rootModel.jbrowse.assemblies.map((assembly: any) => {
      const name = readConfObject(assembly, 'name')
      const aliases = readConfObject(assembly, 'aliases')
      return (
        <TableRow key={name}>
          <TableCell>{name}</TableCell>
          <TableCell>{aliases ? aliases.toString() : ''}</TableCell>
          <TableCell className={classes.buttonCell}>
            <IconButton
              data-testid={`${name}-edit`}
              className={classes.button}
              onClick={() => {
                setIsAssemblyBeingEdited(true)
                setAssemblyBeingEdited(assembly)
              }}
            >
              <CreateIcon color="primary" />
            </IconButton>
            <IconButton
              data-testid={`${name}-delete`}
              className={classes.button}
              onClick={() => {
                removeAssembly(name)
              }}
            >
              <DeleteIcon color="error" />
            </IconButton>
          </TableCell>
        </TableRow>
      )
    })

    return (
      <TableContainer component={Paper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="h5">Name</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="h5">Aliases</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="h5">Actions</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{rows}</TableBody>
        </Table>
      </TableContainer>
    )
  },
)

export default AssemblyTable
