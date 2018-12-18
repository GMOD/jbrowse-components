import React from 'react'
import BaseTrackControls from '../../LinearGenomeView/components/TrackControls'

export default function TrackControls({ track }) {
  return [
    <BaseTrackControls track={track} />,
    <select onChange={evt => track.setRenderer(evt.target.value)}>
      {track.rendererTypeChoices.map(typeName => (
        <option key={typeName} value={typeName}>
          {typeName}
        </option>
      ))}
    </select>,
  ]
}
