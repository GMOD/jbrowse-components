import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles, TextField, MenuItem } from '@material-ui/core'
import { getConf } from '../configuration'
import { AbstractSessionModel } from '../util'

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
  }: {
    session: AbstractSessionModel
    onChange: (arg: string) => void
    selected: string | undefined
  }) => {
    const classes = useStyles()
    const { assemblyNames, assemblyManager } = session
    const error = assemblyNames.length ? '' : 'No configured assemblies'
    return (
      <TextField
        select
        label="Assembly"
        variant="outlined"
        margin="normal"
        helperText={error || 'Select assembly to view'}
        value={error ? '' : selected}
        inputProps={{ 'data-testid': 'assembly-selector' }}
        onChange={event => onChange(event.target.value)}
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
