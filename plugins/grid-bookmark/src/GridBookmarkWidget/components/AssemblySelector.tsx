import React from 'react'
import { observer } from 'mobx-react'

import { MenuItem, TextField } from '@mui/material'

// locals
import { GridBookmarkModel } from '../model'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  textfield: {
    padding: 5,
  },
})

const GridBookmarkAssemblySelector = observer(function AssemblySelector({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { assemblyManager } = getSession(model)
  const { classes } = useStyles()
  const { validAssemblies, selectedAssembly = 'SPECIAL_ALL_ASSEMBLIES_VALUE' } =
    model

  return (
    <TextField
      select
      variant="outlined"
      fullWidth
      className={classes.textfield}
      value={selectedAssembly}
      onChange={event => model.setSelectedAssembly(event.target.value)}
      label="Select assembly"
    >
      <MenuItem value="SPECIAL_ALL_ASSEMBLIES_VALUE">All</MenuItem>
      {[...validAssemblies].map(name => (
        <MenuItem key={name} value={name}>
          {assemblyManager.get(name)?.displayName || name}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default GridBookmarkAssemblySelector
