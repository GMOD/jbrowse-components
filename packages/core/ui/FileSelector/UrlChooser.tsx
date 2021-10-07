import React from 'react'
import { TextField } from '@material-ui/core'
import { observer } from 'mobx-react'
import { FileLocation, isUriLocation } from '../../util/types'

function UrlChooser(props: {
  location?: FileLocation
  setLocation: Function
  label?: string
}) {
  const { location, setLocation, label } = props

  return (
    <>
      <TextField
        fullWidth
        variant="outlined"
        inputProps={{ 'data-testid': 'urlInput' }}
        defaultValue={location && isUriLocation(location) ? location.uri : ''}
        label={label || 'Enter URL'}
        onChange={event => {
          setLocation({
            uri: event.target.value.trim(),
            locationType: 'UriLocation',
          })
        }}
      />
    </>
  )
}

export default observer(UrlChooser)
