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
} from '@mui/material'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { makeStyles } from 'tss-react/mui'

import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'

const useStyles = makeStyles()({
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
})

const AssemblyTable = observer(
  ({
    rootModel,
    setIsAssemblyBeingEdited,
    setAssemblyBeingEdited,
  }: {
    rootModel: {
      jbrowse: {
        removeAssemblyConf: (arg: string) => void
        assemblies: AnyConfigurationModel[]
      }
    }
    setIsAssemblyBeingEdited(arg: boolean): void
    setAssemblyBeingEdited(arg: AnyConfigurationModel): void
  }) => {
    const { classes } = useStyles()

    function removeAssembly(name: string) {
      rootModel.jbrowse.removeAssemblyConf(name)
    }

    const rows = rootModel.jbrowse.assemblies.map(assembly => {
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
