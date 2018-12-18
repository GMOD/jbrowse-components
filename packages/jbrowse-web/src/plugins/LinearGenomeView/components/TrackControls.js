import React from 'react'
import { PropTypes } from 'mobx-react'

import { getConf } from '../../../configuration'

export default function TrackControls({ track, onConfigureClick }) {
  return (
    <div className="track-name">
      {getConf(track, 'name') || track.id}
      <button type="button" onClick={onConfigureClick}>
        configure
      </button>
    </div>
  )
}

TrackControls.propTypes = {
  track: PropTypes.objectOrObservableObject.isRequired,
  onConfigureClick: PropTypes.func,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}
