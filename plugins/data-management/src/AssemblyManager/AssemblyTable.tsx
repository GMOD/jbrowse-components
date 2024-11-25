import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'

import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import { observer } from 'mobx-react'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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
                    onClick={() => {
                      removeAssembly(name)
                    }}
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
