import React, { useState, useEffect } from 'react'
import { TextField, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { getConf } from '../configuration'
import { useLocalStorage } from '../util'
import type { AbstractSessionModel } from '../util'
import type { InputProps as IIP, TextFieldProps as TFP } from '@mui/material'

const useStyles = makeStyles()({
  importFormEntry: {
    minWidth: 180,
  },
})

const AssemblySelector = observer(function ({
  session,
  onChange,
  selected,
  InputProps,
  TextFieldProps,
  localStorageKey,
  helperText = 'Select assembly to view',
}: {
  session: AbstractSessionModel
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
  const [lastSelected, setLastSelected] =
    typeof jest === 'undefined' && localStorageKey
      ? useLocalStorage(
          `lastAssembly-${[
            window.location.host + window.location.pathname,
            config,
            localStorageKey,
          ].join('-')}`,
          selected,
        )
      : useState(selected)

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
      label="Assembly"
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
        htmlInput: { 'data-testid': 'assembly-selector' },
      }}
    >
      {assemblyNames.map(name => {
        const assembly = assemblyManager.get(name)
        const displayName = assembly ? getConf(assembly, 'displayName') : ''
        return (
          <MenuItem key={name} value={name}>
            {displayName || name}
          </MenuItem>
        )
      })}
    </TextField>
  )
})

export default AssemblySelector
