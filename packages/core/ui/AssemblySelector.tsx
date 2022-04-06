import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getConf } from '../configuration'
import { makeStyles, TextField, MenuItem } from '@material-ui/core'
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
  }: {
    session: AbstractSessionModel
    onChange: (arg: string) => void
    selected: string | undefined
  }) => {
    const classes = useStyles()
    const { assemblyNames, assemblyManager } = session
    const [lastSelected, setLastSelected] = useLocalStorage(
      'lastSelectedAsm',
      selected,
    )

    const selection = assemblyNames.includes(lastSelected || '')
      ? lastSelected
      : selected

    useEffect(() => {
      if (selection) {
        onChange(selection)
      }
    }, [selection, onChange])

    const error = assemblyNames.length ? '' : 'No configured assemblies'
    return (
      <TextField
        select
        label="Assembly"
        variant="outlined"
        margin="normal"
        helperText={error || 'Select assembly to view'}
        value={error ? '' : selection}
        inputProps={{ 'data-testid': 'assembly-selector' }}
        onChange={event => setLastSelected(event.target.value)}
        error={!!error}
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
