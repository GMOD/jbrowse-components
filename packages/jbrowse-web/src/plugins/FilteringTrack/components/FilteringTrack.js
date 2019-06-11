import React from 'react'
import ReactPropTypes from 'prop-types'
import { observer, PropTypes } from 'mobx-react'

import { withStyles } from '@material-ui/core'
import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import FilterControls from './FilterControls'
import FilterControlResizeHandle from './FilterControlsResizeHandle'

const styles = theme => ({
  track: {
    background: 'white',
    height: '100%',
    overflow: 'hidden',
  },
  innerTrack: {
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  filterControls: {
    background: theme.palette.background.default,
  },
})

function FilteringTrack({ classes, ...otherProps }) {
  const { model } = otherProps
  const { innerTrackHeight, filterControlHeight, dragHandleHeight } = model
  return (
    <div className={classes.track}>
      <div className={classes.innerTrack} style={{ height: innerTrackHeight }}>
        <BlockBasedTrack {...otherProps} />
      </div>
      <FilterControlResizeHandle
        onVerticalDrag={model.resizeFilterControls}
        style={{ height: dragHandleHeight }}
      />
      <FilterControls style={{ height: filterControlHeight }} {...otherProps} />
    </div>
  )
}

FilteringTrack.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  model: PropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(FilteringTrack))
