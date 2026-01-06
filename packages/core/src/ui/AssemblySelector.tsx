import { useEffect } from 'react'

import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { useLocalStorage } from '../util/index.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { AbstractSessionModel } from '../util/index.ts'
import type { InputProps as IIP, TextFieldProps as TFP } from '@mui/material'

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
  InputProps,
  TextFieldProps,
  localStorageKey,
  helperText = 'Select assembly to view',
}: {
  session: AbstractSessionModel
  label?: string
  helperText?: string
  onChange: (arg: string) => void
  selected?: string
  localStorageKey?: string
  InputProps?: IIP
  TextFieldProps?: TFP
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

  const selection = assemblyNames.includes(lastSelected || '')
    ? lastSelected
    : selected

  useEffect(() => {
    if (selection && selection !== selected) {
      onChange(selection)
    }
  }, [selection, onChange, selected])

  const error = assemblyNames.length ? '' : 'No configured assemblies'
  return (
    <TextField
      select
      data-testid="assembly-selector-textfield"
      label={label}
      variant="outlined"
      helperText={error || helperText}
      value={selection || ''}
      onChange={event => {
        setLastSelected(event.target.value)
      }}
      error={!!error}
      disabled={!!error}
      className={classes.importFormEntry}
      {...TextFieldProps}
      slotProps={{
        input: InputProps,
        htmlInput: {
          'data-testid': 'assembly-selector',
        },
      }}
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
