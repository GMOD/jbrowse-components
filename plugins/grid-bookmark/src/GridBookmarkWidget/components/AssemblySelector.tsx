import React from 'react'
import { observer } from 'mobx-react'

import { Checkbox, MenuItem, SelectChangeEvent, TextField } from '@mui/material'

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
  const { validAssemblies, selectedAssemblies, setSelectedAssemblies } = model
  const allSelected =
    validAssemblies.size > 0 &&
    selectedAssemblies.length === validAssemblies.size

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    if (value.at(-1) === 'All') {
      setSelectedAssemblies(
        selectedAssemblies.length === validAssemblies.size
          ? []
          : [...validAssemblies],
      )
      return
    }
    setSelectedAssemblies([...value])
  }

  return (
    <TextField
      select
      variant="outlined"
      fullWidth
      className={classes.textfield}
      SelectProps={{
        multiple: true,
        value: selectedAssemblies,
        // @ts-ignore
        onChange: handleChange,
        // @ts-ignore
        renderValue: selected => selected.join(', '),
      }}
      label="Select assembly"
    >
      <MenuItem value="All">
        <Checkbox checked={allSelected} />
        All
      </MenuItem>
      {[...validAssemblies].map(name => (
        <MenuItem key={name} value={name}>
          <Checkbox checked={selectedAssemblies.includes(name)} />
          {assemblyManager.get(name)?.displayName || name}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default GridBookmarkAssemblySelector
