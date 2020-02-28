import { TrackControls } from '@gmod/jbrowse-core/ui'
import Icon from '@material-ui/core/Icon'

import React from 'react'

export default function GDCTrackControls(props) {
  const { track } = props
  return (
    <div>
      <TrackControls {...props} />
      <button onClick={track.openFilterConfig}>
        <Icon fontSize="small" style={{ color: '#135560' }}>
          filter_list
        </Icon>
      </button>
    </div>
  )
}
