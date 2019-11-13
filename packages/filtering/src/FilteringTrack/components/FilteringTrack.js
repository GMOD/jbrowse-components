import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import React from 'react'
import FilterControls from './FilterControls'

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
  const { innerTrackHeight, filterControlsHeight, dragHandleHeight } = model
  return (
    <div className={classes.track}>
      <div className={classes.innerTrack} style={{ height: innerTrackHeight }}>
        <BlockBasedTrack {...props} />
      </div>
      <ResizeHandle
        onDrag={model.resizeFilterControls}
        style={{
          height: dragHandleHeight,
          background: '#ccc',
          boxSizing: 'border-box',
          borderTop: '1px solid #fafafa',
        }}
      />
      <FilterControls style={{ height: filterControlsHeight }} {...props} />
    </div>
  )
}

FilteringTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default observer(FilteringTrack)
