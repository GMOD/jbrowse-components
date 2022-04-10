import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import React, { useEffect } from 'react'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'

function ConnectionTypeSelect(props: {
  connectionTypeChoices: ConnectionType[]
  connectionType: ConnectionType
  setConnectionType: Function
}) {
  const { connectionTypeChoices, connectionType, setConnectionType } = props

  useEffect(() => {
    if (!connectionType.name) {
      setConnectionType(connectionTypeChoices[0])
    }
  })

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
  if (!connectionType.name) {
    return null
  }
  return (
    <form autoComplete="off">
      <TextField
        value={connectionType.name}
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
        variant="outlined"
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
