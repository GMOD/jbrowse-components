import React, { useEffect } from 'react'
import { observer } from 'mobx-react'

import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  ListItemText,
  OutlinedInput,
  ListItemIcon,
  SelectChangeEvent,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import { GridBookmarkModel } from '../model'

const useStyles = makeStyles()(() => ({
  bold: {
    fontWeight: 700,
  },
}))

const AssemblySelector = observer(function ({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const { validAssemblies, selectedAssemblies, setSelectedAssemblies } = model
  const noAssemblies = validAssemblies.length === 0 ? true : false
  const label = 'Select assemblies'
  const isAllSelected =
    validAssemblies.length > 0 &&
    selectedAssemblies.length === validAssemblies.length

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    if (value.at(-1) === 'all') {
      setSelectedAssemblies(
        selectedAssemblies.length === validAssemblies.length
          ? []
          : validAssemblies,
      )
      return
    }
    setSelectedAssemblies([...value])
  }

  return (
    <FormControl disabled={noAssemblies}>
      <InputLabel id="select-assemblies-label">{label}</InputLabel>
      <Select
        labelId="select-assemblies-label"
        id="select-assemblies"
        multiple
        value={selectedAssemblies}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        renderValue={selected => selected.join(', ')}
      >
        <MenuItem value="all">
          <ListItemIcon>
            <Checkbox
              checked={isAllSelected}
              indeterminate={
                selectedAssemblies.length > 0 &&
                selectedAssemblies.length < validAssemblies.length
              }
            />
          </ListItemIcon>
          <ListItemText
            classes={{ primary: classes.bold }}
            primary="Select All"
          />
        </MenuItem>
        {validAssemblies.map(name => (
          <MenuItem key={name} value={name}>
            <Checkbox checked={selectedAssemblies.includes(name)} />
            <ListItemText primary={name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default AssemblySelector
