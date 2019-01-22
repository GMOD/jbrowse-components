import React from 'react'
import ReactPropTypes from 'prop-types'
import { observer, PropTypes } from 'mobx-react'

import { withStyles } from '@material-ui/core'
import TrackBlocks from './TrackBlocks'

const styles = (/* theme */) => ({
  track: {
    color: 'white',
    position: 'relative',
    height: '100%',
  },
})

function BlockBasedTrack({ classes, ...otherProps }) {
  const { model } = otherProps
  return (
    <div className={classes.track}>
      <TrackBlocks {...otherProps} blockState={model.blockState} />
    </div>
  )
}

BlockBasedTrack.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  model: PropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(BlockBasedTrack))
