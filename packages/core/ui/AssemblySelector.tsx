import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getConf } from '../configuration'
import {
  TextField,
  MenuItem,
  InputProps as IIP,
} from '@mui/material'
import { makeStyles } from '@mui/styles'
import { AbstractSessionModel } from '../util'
const useStyles = makeStyles(() => ({
  importFormEntry: {
    minWidth: 180,
  },
}))

// Hook from https://usehooks.com/useLocalStorage/
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(error)
    }
  }
  return [storedValue, setValue] as const
}

const AssemblySelector = observer(
  ({
    session,
    onChange,
    selected,
    InputProps,
    extra = 0,
  }: {
    session: AbstractSessionModel
    onChange: (arg: string) => void
    selected: string | undefined
    InputProps?: IIP
    extra?: unknown
  }) => {
    const classes = useStyles()
    const { assemblyNames, assemblyManager } = session

    // constructs a localstorage key based on host/path/config to help
    // remember. non-config assists usage with e.g. embedded apps
    const config = new URLSearchParams(window.location.search).get('config')
    const [lastSelected, setLastSelected] = useLocalStorage(
      `lastAssembly-${[
        window.location.host + window.location.pathname,
        config,
        extra,
      ].join('-')}`,
      selected,
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
        label="Assembly"
        variant="outlined"
        helperText={error || 'Select assembly to view'}
        value={error ? '' : selection}
        inputProps={{ 'data-testid': 'assembly-selector' }}
        onChange={event => setLastSelected(event.target.value)}
        error={!!error}
        InputProps={InputProps}
        disabled={!!error}
        className={classes.importFormEntry}
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
  },
)

export default AssemblySelector
