import React from 'react'
import { observer } from 'mobx-react'
import BaseTrackControls from '../../LinearGenomeView/components/TrackControls'
import { getConf } from '../../../configuration'

export default observer(({ track, onConfigureClick }) => (
  <>
    <BaseTrackControls track={track} onConfigureClick={onConfigureClick} />
    <select
      onChange={evt => track.setRenderer(evt.target.value)}
      value={track.selectedRendering || getConf(track, 'defaultRendering')}
    >
      {track.rendererTypeChoices.map(typeName => (
        <option key={typeName} value={typeName}>
          {typeName}
        </option>
      ))}
    </select>
  </>
))
