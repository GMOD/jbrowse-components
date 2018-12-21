import React from 'react'
import BaseTrackControls from '../../LinearGenomeView/components/TrackControls'
import { getConf } from '../../../configuration'

export default function TrackControls({ track, onConfigureClick }) {
  return [
    <BaseTrackControls
      key="base"
      track={track}
      onConfigureClick={onConfigureClick}
    />,
    <select
      key="renderSelect"
      onChange={evt => track.setRenderer(evt.target.value)}
      value={track.selectedRendering || getConf(track, 'defaultRendering')}
    >
      {track.rendererTypeChoices.map(typeName => (
        <option key={typeName} value={typeName}>
          {typeName}
        </option>
      ))}
    </select>,
  ]
}
