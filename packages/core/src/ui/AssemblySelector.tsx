import { useEffect } from 'react'

import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { useLocalStorage } from '../util/index.ts'
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
  localStorageKey,
  helperText = 'Select assembly to view',
}: {
  session: AbstractSessionModel
  label?: string
  helperText?: string
  onChange: (arg: string) => void
  selected?: string
  fullWidth?: boolean
  localStorageKey?: string
}) {
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session

  // constructs a localstorage key based on host/path/config to help
  // remember. non-config assists usage with e.g. embedded apps
  const config = new URLSearchParams(window.location.search).get('config')
  const [lastSelected, setLastSelected] = useLocalStorage(
    `lastAssembly-${[
      window.location.host + window.location.pathname,
      config,
      localStorageKey,
    ].join('-')}`,
    selected,
    typeof jest === 'undefined' && Boolean(localStorageKey),
  )

  // prefer a remembered assembly, else the explicitly selected one, but only
  // when it's actually a configured assembly (otherwise MUI warns about an
  // out-of-range select value)
  const selection = assemblyNames.includes(lastSelected ?? '')
    ? lastSelected
    : assemblyNames.includes(selected ?? '')
      ? selected
      : undefined

  useEffect(() => {
    if (selection && selection !== selected) {
      onChange(selection)
    }
  }, [selection, onChange, selected])

  const error = assemblyNames.length ? '' : 'No configured assemblies'
  return (
    <TextField
      select
      label={label}
      variant="outlined"
      helperText={error || helperText}
      value={selection ?? ''}
      fullWidth={fullWidth}
      onChange={event => {
        setLastSelected(event.target.value)
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
