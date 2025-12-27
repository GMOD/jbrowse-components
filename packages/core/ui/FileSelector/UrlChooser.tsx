import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { isUriLocation } from '../../util/types'

import type { FileLocation } from '../../util/types'

const UrlChooser = observer(function UrlChooser({
  location,
  label,
  style,
  setLocation,
}: {
  location?: FileLocation
  label?: string
  style?: Record<string, unknown>
  setLocation: (arg: FileLocation) => void
}) {
  return (
    <TextField
      variant="outlined"
      fullWidth
      defaultValue={location && isUriLocation(location) ? location.uri : ''}
      label={label || 'Enter URL'}
      style={style}
      onChange={event => {
        setLocation({
          uri: event.target.value.trim(),
          locationType: 'UriLocation',
        })
      }}
      slotProps={{
        htmlInput: {
          'data-testid': 'urlInput',
        },
      }}
    />
  )
})

export default UrlChooser
