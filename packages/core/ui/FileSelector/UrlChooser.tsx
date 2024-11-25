import React from 'react'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { isUriLocation } from '../../util/types'
import type { FileLocation } from '../../util/types'

const UrlChooser = observer(function ({
  location,
  setLocation,
  label,
}: {
  location?: FileLocation
  setLocation: (arg: FileLocation) => void
  label?: string
}) {
  return (
    <TextField
      fullWidth
      variant="outlined"
      defaultValue={location && isUriLocation(location) ? location.uri : ''}
      label={label || 'Enter URL'}
      onChange={event => {
        setLocation({
          uri: event.target.value.trim(),
          locationType: 'UriLocation',
        })
      }}
      slotProps={{
        htmlInput: { 'data-testid': 'urlInput' },
      }}
    />
  )
})

export default UrlChooser
