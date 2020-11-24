import { ResizeHandle } from '@jbrowse/core/ui'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import React from 'react'
import FilterControls from './FilterControls'

const useStyles = makeStyles(theme => ({
  display: {
    background: 'white',
    height: '100%',
    overflow: 'hidden',
  },
  innerDisplay: {
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  filterControls: {
    background: theme.palette.background.default,
  },
}))

function LinearFilteringDisplay(props) {
  const { model } = props
  const classes = useStyles()
  const { innerDisplayHeight, filterControlsHeight, dragHandleHeight } = model
  return (
    <div className={classes.display}>
      <div
        className={classes.innerDisplay}
        style={{ height: innerDisplayHeight }}
      >
        <BaseLinearDisplayComponent {...props} />
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

LinearFilteringDisplay.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default observer(LinearFilteringDisplay)
