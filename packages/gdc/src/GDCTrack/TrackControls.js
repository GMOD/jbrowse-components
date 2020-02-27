import { TrackControls } from '@gmod/jbrowse-core/ui'
import React from 'react'

export default function GDCTrackControls(props) {
  return (
    <div>
      <TrackControls {...props} />
      <button>Click Me</button>
    </div>
  )
}
