import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { makeStyles, TextField, MenuItem } from '@material-ui/core'
import { AbstractSessionModel } from '@jbrowse/core/util'
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
        onChange={event => onChange(event.target.value)}
        error={!!error}
        disabled={!!error}
        className={classes.importFormEntry}
      >
        {assemblyNames.map(name => (
          <MenuItem key={name} value={name}>
            {getConf(assemblyManager.get(name), 'displayName') || name}
          </MenuItem>
        ))}
      </TextField>
    )
  },
)

export default AssemblySelector
