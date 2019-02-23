import { Icon, IconButton, withStyles } from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton'
import classnames from 'classnames'
import { inject, observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

import ConfigureToggleButton from '../../../components/ConfigureToggleButton'
import ScaleBar from './ScaleBar'
import TrackRenderingContainer from './TrackRenderingContainer'
import TrackResizeHandle from './TrackResizeHandle'

import ZoomControls from './ZoomControls'

const dragHandleHeight = 3

const styles = theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing.unit,
  },
  linearGenomeView: {
    background: '#eee',
    // background: theme.palette.background.paper,
    boxSizing: 'content-box',
  },
  controls: {
    borderRight: '1px solid gray',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  viewControls: {
    height: '100%',
    borderBottom: '1px solid #9e9e9e',
    boxSizing: 'border-box',
  },
  trackControls: {
    whiteSpace: 'normal',
  },
  zoomControls: {
    position: 'absolute',
    top: '0px',
  },
  iconButton: {
    padding: theme.spacing.unit / 2,
  },
})

function LinearGenomeView(props) {
  const scaleBarHeight = 32
  const { classes, model, rootModel } = props
  const {
    id,
    staticBlocks,
    tracks,
    bpPerPx,
    width,
    controlsWidth,
    offsetPx,
  } = model
  // NOTE: offsetPx is the total offset in px of the viewing window into the
  // whole set of concatenated regions. this number is often quite large.
  const height =
    scaleBarHeight + tracks.reduce((a, b) => a + b.height + dragHandleHeight, 0)
  const style = {
    display: 'grid',
    width: `${width}px`,
    height: `${height}px`,
    position: 'relative',
    gridTemplateRows: `[scale-bar] auto ${tracks
      .map(
        t =>
          `[track-${t.id}] ${t.height}px [resize-${
            t.id
          }] ${dragHandleHeight}px`,
      )
      .join(' ')}`,
    gridTemplateColumns: `[controls] ${controlsWidth}px [blocks] auto`,
  }
  // console.log(style)
  return (
    <div className={classes.root}>
      <div
        className={classes.linearGenomeView}
        key={`view-${id}`}
        style={style}
      >
        <div
          className={classnames(classes.controls, classes.viewControls)}
          style={{ gridRow: 'scale-bar' }}
        >
          {model.hideControls ? null : (
            <>
              <IconButton
                onClick={model.closeView}
                className={classes.iconButton}
                title="close this view"
              >
                <Icon fontSize="small">close</Icon>
              </IconButton>
              <ConfigureToggleButton
                model={model}
                onClick={model.activateConfigurationUI}
                title="configure view"
                style={{}}
                fontSize="small"
              />
              <ToggleButton
                onClick={model.activateTrackSelector}
                title="select tracks"
                selected={
                  rootModel.visibleDrawerWidget &&
                  rootModel.visibleDrawerWidget.id ===
                    'hierarchicalTrackSelector' &&
                  rootModel.visibleDrawerWidget.view.id === model.id
                }
                value="track_select"
              >
                <Icon fontSize="small">line_style</Icon>
              </ToggleButton>
            </>
          )}
        </div>
        <ScaleBar
          style={{ gridColumn: 'blocks', gridRow: 'scale-bar' }}
          height={scaleBarHeight}
          bpPerPx={bpPerPx}
          blocks={staticBlocks}
          offsetPx={offsetPx}
          horizontallyFlipped={model.horizontallyFlipped}
          width={model.viewingRegionWidth}
        />
        <div
          className={classes.zoomControls}
          style={{
            right: 4,
          }}
        >
          <ZoomControls model={model} controlsHeight={scaleBarHeight} />
        </div>
        {tracks.map(track => [
          <div
            className={classnames(classes.controls, classes.trackControls)}
            key={`controls:${track.id}`}
            style={{ gridRow: `track-${track.id}`, gridColumn: 'controls' }}
          >
            <track.ControlsComponent
              track={track}
              key={track.id}
              view={model}
              onConfigureClick={track.activateConfigurationUI}
            />
          </div>,
          <TrackRenderingContainer
            key={`track-rendering:${track.id}`}
            trackId={track.id}
            width={model.viewingRegionWidth}
          >
            <track.RenderingComponent
              model={track}
              offsetPx={offsetPx}
              bpPerPx={bpPerPx}
              blockState={{}}
              onHorizontalScroll={model.horizontalScroll}
            />
          </TrackRenderingContainer>,
          <TrackResizeHandle
            key={`handle:${track.id}`}
            trackId={track.id}
            onVerticalDrag={model.resizeTrack}
          />,
        ])}
      </div>
    </div>
  )
}
LinearGenomeView.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  model: PropTypes.objectOrObservableObject.isRequired,
  rootModel: PropTypes.objectOrObservableObject.isRequired,
}

export default inject('rootModel')(
  withStyles(styles)(observer(LinearGenomeView)),
)
