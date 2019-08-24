import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { makeStyles } from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import React from 'react'
import FilterControls from './FilterControls'
import FilterControlResizeHandle from './FilterControlsResizeHandle'

const useStyles = makeStyles(theme => ({
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
}))

function FilteringTrack(props) {
  const { model } = props
  const classes = useStyles()
  const { innerTrackHeight, filterControlHeight, dragHandleHeight } = model
  return (
    <div className={classes.track}>
      <div className={classes.innerTrack} style={{ height: innerTrackHeight }}>
        <BlockBasedTrack {...props} />
      </div>
      <FilterControlResizeHandle
        onVerticalDrag={model.resizeFilterControls}
        style={{ height: dragHandleHeight }}
      />
      <FilterControls style={{ height: filterControlHeight }} {...props} />
    </div>
  )
}

FilteringTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default observer(FilteringTrack)
