import { useState } from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { isUriLocation } from '../../util/types/index.ts'

import type { FileLocation } from '../../util/types/index.ts'

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
  const uri = location && isUriLocation(location) ? location.uri : ''

  // What the box shows, which is not quite the location: the location is
  // trimmed and this is what was typed.
  //
  // The box used to be uncontrolled (`defaultValue`), which reads the location
  // once at mount and ignores every later one — so a form that FILLS a field in
  // for the user showed them an empty box, and the add-track widget's "found the
  // index sitting next to your file" note sat under nothing.
  //
  // Both conditions are load-bearing. A uri that has not changed is not news,
  // however far the box has drifted from it — that is the parent that ignores
  // `setLocation`, where overwriting would make the field untypeable. And a uri
  // that matches what is on screen once trimmed is our own edit coming back, so
  // adopting it would delete a space as fast as it was typed.
  const [typed, setTyped] = useState(uri)
  const [lastUri, setLastUri] = useState(uri)
  if (uri !== lastUri) {
    setLastUri(uri)
    if (uri !== typed.trim()) {
      setTyped(uri)
    }
  }

  return (
    <TextField
      variant="outlined"
      fullWidth
      value={typed}
      label={label || 'Enter URL'}
      style={style}
      onChange={event => {
        setTyped(event.target.value)
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
