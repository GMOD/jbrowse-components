import React, { useEffect } from 'react'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { IconButton, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import type { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

// icons

const ConnectionTypeSelect = observer(function ConnectionTypeSelect({
  connectionTypeChoices,
  connectionType,
  setConnectionType,
}: {
  connectionTypeChoices: ConnectionType[]
  connectionType?: ConnectionType
  setConnectionType: (c?: ConnectionType) => void
}) {
  const firstChoice = connectionTypeChoices[0]
  useEffect(() => {
    if (!connectionType) {
      setConnectionType(firstChoice)
    }
  }, [connectionType, firstChoice, setConnectionType])

  return (
    <form autoComplete="off">
      {connectionType ? (
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
                  >
                    <OpenInNewIcon />
                  </IconButton>
                ) : null}
              </>
            ) : null
          }
          select
          fullWidth
          onChange={event => {
            setConnectionType(
              connectionTypeChoices.find(c => c.name === event.target.value),
            )
          }}
          variant="outlined"
        >
          {connectionTypeChoices.map(c => (
            <MenuItem key={c.name} value={c.name}>
              {c.displayName || c.name}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
    </form>
  )
})

export default ConnectionTypeSelect
