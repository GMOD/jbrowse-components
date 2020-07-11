import IconButton from '@material-ui/core/IconButton'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import React from 'react'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'

import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'

function ConnectionTypeSelect(props: {
  connectionTypeChoices: ConnectionType[]
  connectionType: ConnectionType
  setConnectionType: Function
  assemblyNameChoices: string[]
  assemblyName: string
  setAssemblyName: Function
}): JSX.Element {
  const {
    connectionTypeChoices,
    connectionType,
    setConnectionType,
    assemblyNameChoices,
    assemblyName,
    setAssemblyName,
  } = props

  function handleChange(
    event: React.ChangeEvent<{ name?: string; value: unknown }>,
  ): void {
    setConnectionType(
      connectionTypeChoices.find(
        (connectionTypeChoice: ConnectionType) =>
          connectionTypeChoice.name === event.target.value,
      ),
    )
  }

  return (
    <form autoComplete="off">
      <TextField
        value={assemblyName}
        label="assemblyName"
        helperText="Assembly to which the track will be added"
        select
        fullWidth
        onChange={(event): void => setAssemblyName(event.target.value)}
        inputProps={{ 'data-testid': 'assemblyNameSelect' }}
      >
        {assemblyNameChoices.map(assemblyNameChoice => (
          <MenuItem key={assemblyNameChoice} value={assemblyNameChoice}>
            {assemblyNameChoice}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        value={connectionType.name || ''}
        label="connectionType"
        helperText={
          connectionType.description ? (
            <>
              {connectionType.description}
              {connectionType.url ? (
                <IconButton
                  href={connectionType.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  color="secondary"
                >
                  <OpenInNewIcon />
                </IconButton>
              ) : null}
            </>
          ) : null
        }
        select
        fullWidth
        onChange={handleChange}
      >
        {connectionTypeChoices.map((connectionTypeChoice: ConnectionType) => (
          <MenuItem
            key={connectionTypeChoice.name}
            value={connectionTypeChoice.name}
          >
            {connectionTypeChoice.displayName || connectionTypeChoice.name}
          </MenuItem>
        ))}
      </TextField>
    </form>
  )
}

export default ConnectionTypeSelect
