import { Icon, IconButton, withStyles } from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton'
import classnames from 'classnames'
import { inject, observer, PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'

import ConfigureToggleButton from '../../../components/ConfigureToggleButton'
import ScaleBar from './ScaleBar'
import TrackRenderingContainer from './TrackRenderingContainer'
import TrackResizeHandle from './TrackResizeHandle'

import ZoomControls from './ZoomControls'

const dragHandleHeight = 3

const styles = theme => ({
  root: {
    position: 'relative',
  },
  linearGenomeView: {
    background: '#eee',
    // background: theme.palette.background.paper,
    border: '1px solid hsl(0, 0%, 0%)',
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
    right: theme.spacing.unit / 2,
    top: '0px',
    zIndex: 999,
  },
  iconButton: {
    padding: theme.spacing.unit / 2,
  },
})

@inject('rootModel')
@withStyles(styles)
@observer
class LinearGenomeView extends Component {
  static propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    model: PropTypes.observableObject.isRequired,
  }

  render() {
    const scaleBarHeight = 32
    const { classes, model } = this.props
    const {
      id,
      blocks,
      tracks,
      bpPerPx,
      width,
      controlsWidth,
      offsetPx,
    } = model
    const rootModel = getRoot(model)
    // NOTE: offsetPx is the total offset in px of the viewing window into the
    // whole set of concatenated regions. this number is often quite large.
    // visibleBlocksOffsetPx is the offset of the viewing window into the set of blocks
    // that are *currently* being displayed
    const visibleBlocksOffsetPx = blocks[0] ? offsetPx - blocks[0].offsetPx : 0
    const height =
      scaleBarHeight +
      tracks.reduce((a, b) => a + b.height + dragHandleHeight, 0)
    const style = {
      display: 'grid',
      width: `${width}px`,
      height: `${height}px`,
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
                rootModel.task &&
                rootModel.task.taskName === 'track_select' &&
                rootModel.task.data === model
              }
              value="track_select"
            >
              <Icon fontSize="small">line_style</Icon>
            </ToggleButton>
          </div>
          <ScaleBar
            style={{ gridColumn: 'blocks', gridRow: 'scale-bar' }}
            height={scaleBarHeight}
            bpPerPx={bpPerPx}
            blocks={blocks}
            offsetPx={visibleBlocksOffsetPx}
            horizontallyFlipped={model.horizontallyFlipped}
            width={width - controlsWidth}
          />
          <div className={classes.zoomControls}>
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
              width={width - controlsWidth}
              onHorizontalScroll={model.horizontalScroll}
            >
              <track.RenderingComponent
                model={track}
                blockDefinitions={blocks}
                offsetPx={visibleBlocksOffsetPx}
                bpPerPx={bpPerPx}
                blockState={{}}
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
}

export default LinearGenomeView
