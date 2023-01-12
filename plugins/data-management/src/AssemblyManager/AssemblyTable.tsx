import React from 'react'
import { observer } from 'mobx-react'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'

import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'

const AssemblyTable = observer(function ({
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
}) {
  function removeAssembly(name: string) {
    rootModel.jbrowse.removeAssemblyConf(name)
  }

  const { assemblies } = rootModel.jbrowse

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Display name</TableCell>
            <TableCell>Aliases</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assemblies.map(assembly => {
            const name = readConfObject(assembly, 'name')
            const displayName = readConfObject(assembly, 'displayName')
            const aliases = readConfObject(assembly, 'aliases')
            return (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
                <TableCell>{displayName}</TableCell>
                <TableCell>{aliases ? aliases.toString() : ''}</TableCell>
                <TableCell>
                  <IconButton
                    data-testid={`${name}-edit`}
                    onClick={() => {
                      setIsAssemblyBeingEdited(true)
                      setAssemblyBeingEdited(assembly)
                    }}
                  >
                    <CreateIcon color="primary" />
                  </IconButton>
                  <IconButton
                    data-testid={`${name}-delete`}
                    onClick={() => removeAssembly(name)}
                  >
                    <DeleteIcon color="error" />
                  </IconButton>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
})

export default AssemblyTable
