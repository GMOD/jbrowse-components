import React from 'react'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { FileLocation, isUriLocation } from '../../util/types'

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
      inputProps={{ 'data-testid': 'urlInput' }}
      defaultValue={location && isUriLocation(location) ? location.uri : ''}
      label={label || 'Enter URL'}
      onChange={event => {
        setLocation({
          locationType: 'UriLocation',
          uri: event.target.value.trim(),
        })
      }}
    />
  )
})

export default UrlChooser
