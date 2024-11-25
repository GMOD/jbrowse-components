import React from 'react'
import {
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from '@mui/material'
import { observer } from 'mobx-react'

// locals
import type { GridBookmarkModel } from '../model'

const AssemblySelector = observer(function ({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { validAssemblies, selectedAssemblies } = model
  const noAssemblies = validAssemblies.size === 0
  const label = 'Select assemblies'
  const id = 'select-assemblies-label'
  const selectedSet = new Set(selectedAssemblies)
  const isAllSelected = [...validAssemblies].every(e => selectedSet.has(e))

  return (
    <FormControl disabled={noAssemblies} fullWidth>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        multiple
        value={selectedAssemblies}
        onChange={event => {
          model.setSelectedAssemblies([...event.target.value])
        }}
        input={<OutlinedInput label={label} />}
        renderValue={selected => selected.join(', ')}
      >
        <MenuItem
          onClickCapture={event => {
            // onClickCapture allows us to avoid the parent Select onChange from triggering
            if (isAllSelected) {
              model.setSelectedAssemblies([])
            } else {
              model.setSelectedAssemblies(undefined)
            }
            event.preventDefault()
          }}
        >
          <Checkbox
            checked={isAllSelected}
            indeterminate={!isAllSelected && selectedAssemblies.length > 0}
          />
          <ListItemText primary="Select all" />
        </MenuItem>
        {[...validAssemblies].map(name => (
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
