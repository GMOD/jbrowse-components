import React, { useEffect } from 'react'
import { IconButton, MenuItem, TextField } from '@mui/material'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import { observer } from 'mobx-react'

// icons
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

export default observer(function ConnectionTypeSelect({
  connectionTypeChoices,
  connectionType,
  setConnectionType,
}: {
  connectionTypeChoices: ConnectionType[]
  connectionType?: ConnectionType
  setConnectionType: (c?: ConnectionType) => void
}) {
  useEffect(() => {
    if (!connectionType) {
      setConnectionType(connectionTypeChoices[0])
    }
  })

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
          onChange={event =>
            setConnectionType(
              connectionTypeChoices.find(c => c.name === event.target.value),
            )
          }
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
