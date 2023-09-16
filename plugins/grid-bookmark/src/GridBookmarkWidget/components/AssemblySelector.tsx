import React from 'react'
import { observer } from 'mobx-react'

import { MenuItem, TextField } from '@mui/material'

// locals
import { GridBookmarkModel } from '../model'

const GridBookmarkAssemblySelector = observer(function AssemblySelector({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { validAssemblies, selectedAssembly } = model

  return (
    <TextField
      variant="outlined"
      select
      value={selectedAssembly}
      onChange={event => model.setSelectedAssembly(event.target.value)}
      label="Select assembly"
    >
      {validAssemblies.map(name => (
        <MenuItem key={name} value={name}>
          {name}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default GridBookmarkAssemblySelector
