import React from 'react'
import Button from '@material-ui/core/Button'
import { PropTypes, observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { getConf } from '../../../configuration'

function TrackControls({ track, onConfigureClick }) {
  return (
    <>
      <div className="track-name">{getConf(track, 'name') || track.id}</div>
      <Button
        type="button"
        onClick={onConfigureClick}
        size="small"
        color="secondary"
      >
        configure
      </Button>
    </>
  )
}

TrackControls.propTypes = {
  track: PropTypes.objectOrObservableObject.isRequired,
  onConfigureClick: ReactPropTypes.func,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}

export default observer(TrackControls)
