import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import React from 'react'

interface ConnectionType {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stateModel: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configSchema: Record<string, any>
  displayName?: string
  description?: string
  url?: string
}

function ConnectionTypeSelect(props: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectionTypeChoices: ConnectionType[]
  connectionType: ConnectionType
  setConnectionType: Function
  speciesNameChoices: string[]
  speciesName: string
  setSpeciesName: Function
}): JSX.Element {
  const {
    connectionTypeChoices,
    connectionType,
    setConnectionType,
    speciesNameChoices,
    speciesName,
    setSpeciesName,
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
        value={speciesName}
        label="speciesName"
        helperText="Species to which the track will be added"
        select
        fullWidth
        onChange={event => setSpeciesName(event.target.value)}
        inputProps={{ 'data-testid': 'speciesNameSelect' }}
      >
        {speciesNameChoices.map(speciesNameChoice => (
          <MenuItem key={speciesNameChoice} value={speciesNameChoice}>
            {speciesNameChoice}
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
                >
                  <Icon>open_in_new</Icon>
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
