import React from 'react'
import ReactPropTypes from 'prop-types'
import { observer, PropTypes } from 'mobx-react'

import { withStyles } from '@material-ui/core'

const styles = theme => ({
  track: {
    background: 'white',
  },
  dragHandle: {
    height: '3px',
    width: '100%',
    background: '#eee',
    cursor: 'ns-resize',
  },
  filterControls: {
    background: theme.palette.background.default,
  },
})

function FilteringTrack({ classes, ...otherProps }) {
  const { model } = otherProps
  const InnerTrack = model.filteredTrack
    ? model.filteredTrack.reactComponent
    : () => null
  return (
    <div className={classes.track}>
      <div className={classes.innerTrack}>
        <InnerTrack {...otherProps} model={model.filteredTrack} />
      </div>
      <div className={classes.dragHandle} />
      <div className={classes.filterControls}>
        these are going to be filter controls
      </div>
    </div>
  )
}

FilteringTrack.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  model: PropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(FilteringTrack))
