import React from 'react'
import { observer } from 'mobx-react'
import {
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { readConfObject } from '@jbrowse/core/configuration'

// icons
import CreateIcon from '@material-ui/icons/Create'
import DeleteIcon from '@material-ui/icons/Delete'

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
    session,
    setIsAssemblyBeingEdited,
    setAssemblyBeingEdited,
  }: {
    session: {
      assemblies: AnyConfigurationModel[]
      removeAssembly?: (arg: string) => void
    }
    setIsAssemblyBeingEdited(arg: boolean): void
    setAssemblyBeingEdited(arg: AnyConfigurationModel): void
  }) => {
    const classes = useStyles()
    const rows = session.assemblies.map(assembly => {
      const name = readConfObject(assembly, 'name')
      const displayName = readConfObject(assembly, 'displayName')
      const aliases = readConfObject(assembly, 'aliases')
      return (
        <TableRow key={name}>
          <TableCell>{name}</TableCell>
          <TableCell>{displayName}</TableCell>
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
              onClick={() => session.removeAssembly?.(name)}
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
                <Typography variant="h5">Display name</Typography>
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
