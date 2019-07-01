import React from 'react'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import MenuItem from '@material-ui/core/MenuItem'
import FormHelperText from '@material-ui/core/FormHelperText'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'

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
  connectionTypeChoices: ConnectionType[]
  connectionType: ConnectionType
  setConnectionType: Function
}): JSX.Element {
  const { connectionTypeChoices, connectionType, setConnectionType } = props

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
      <FormControl fullWidth>
        <Select value={connectionType.name || ''} onChange={handleChange}>
          {connectionTypeChoices.map((connectionTypeChoice: ConnectionType) => (
            <MenuItem
              key={connectionTypeChoice.name}
              value={connectionTypeChoice.name}
            >
              {connectionTypeChoice.displayName || connectionTypeChoice.name}
            </MenuItem>
          ))}
        </Select>
        {connectionType.description ? (
          <FormHelperText>
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
          </FormHelperText>
        ) : null}
      </FormControl>
    </form>
  )
}

export default ConnectionTypeSelect
