import React, { useEffect } from 'react'
import { observer } from 'mobx-react'
import { getConf } from '../configuration'
import {
  makeStyles,
  TextField,
  MenuItem,
  InputProps as IIP,
} from '@material-ui/core'
import { AbstractSessionModel, useLocalStorage } from '../util'
const useStyles = makeStyles(() => ({
  importFormEntry: {
    minWidth: 180,
  },
}))

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
