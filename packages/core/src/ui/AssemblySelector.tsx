import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'

import type { AssemblyHost } from '../util/index.ts'

const useStyles = makeStyles()({
  importFormEntry: {
    minWidth: 180,
  },
})

const AssemblySelector = observer(function AssemblySelector({
  session,
  onChange,
  label = 'Assembly',
  selected,
  fullWidth,
  helperText = 'Select assembly to view',
}: {
  session: AssemblyHost
  label?: string
  helperText?: string
  onChange: (arg: string) => void
  selected?: string
  fullWidth?: boolean
}) {
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session

  // A selection the host does not offer still shows when the manager resolves
  // it: an alias, or the assembly a comparative view synthesized for its own
  // panel, which is what the add-track form there submits to. A removed one is
  // dropped, so MUI doesn't warn about an out-of-range value.
  const canonical = selected
    ? (assemblyManager.getCanonicalAssemblyName(selected) ?? selected)
    : ''
  const options =
    !canonical ||
    assemblyNames.includes(canonical) ||
    !assemblyManager.get(canonical)
      ? assemblyNames
      : [...assemblyNames, canonical]
  const value = options.includes(canonical) ? canonical : ''
  const error = assemblyNames.length ? '' : 'No configured assemblies'
  return (
    <TextField
      select
      label={label}
      variant="outlined"
      helperText={error || helperText}
      value={value}
      fullWidth={fullWidth}
      onChange={event => {
        onChange(event.target.value)
      }}
      error={!!error}
      disabled={!!error}
      className={classes.importFormEntry}
    >
      {options.map(name => (
        <MenuItem key={name} value={name}>
          {assemblyManager.get(name)?.displayName || name}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default AssemblySelector
