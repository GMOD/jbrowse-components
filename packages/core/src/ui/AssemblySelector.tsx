import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'

import type { AbstractSessionModel } from '../util/index.ts'

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
  session: AbstractSessionModel
  label?: string
  helperText?: string
  onChange: (arg: string) => void
  selected?: string
  fullWidth?: boolean
}) {
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session

  // ignore a stale/removed selection so MUI doesn't warn about an out-of-range
  // select value
  const value = selected && assemblyNames.includes(selected) ? selected : ''
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
      {assemblyNames.map(name => (
        <MenuItem key={name} value={name}>
          {assemblyManager.get(name)?.displayName || name}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default AssemblySelector
