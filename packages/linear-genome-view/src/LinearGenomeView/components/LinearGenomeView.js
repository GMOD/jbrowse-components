import { Icon, IconButton, makeStyles } from '@material-ui/core'
import { getSession } from '@gmod/jbrowse-core/util'
import ToggleButton from '@material-ui/lab/ToggleButton'
import classnames from 'classnames'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useState } from 'react'

import ScaleBar from './ScaleBar'
import Rubberband from './Rubberband'
import TrackRenderingContainer from './TrackRenderingContainer'
import TrackResizeHandle from './TrackResizeHandle'

import ZoomControls from './ZoomControls'

import buttonStyles from './buttonStyles'

const dragHandleHeight = 3

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
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

  ...buttonStyles(theme),
}))

const TrackContainer = observer(({ model, track }) => {
  const classes = useStyles()
  const { bpPerPx, offsetPx } = model
  const [scrollTop, setScrollTop] = useState(0)
  return (
    <>
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
      </div>
      <TrackRenderingContainer
        key={`track-rendering:${track.id}`}
        trackId={track.id}
        height={track.height}
        scrollTop={scrollTop}
        onHorizontalScroll={model.horizontalScroll}
        onVerticalScroll={value => {
          setScrollTop(
            Math.min(Math.max(scrollTop + value, 0), track.height + 10),
          )
        }}
      >
        <track.RenderingComponent
          model={track}
          offsetPx={offsetPx}
          bpPerPx={bpPerPx}
          blockState={{}}
          onHorizontalScroll={model.horizontalScroll}
        />
      </TrackRenderingContainer>
      <TrackResizeHandle
        key={`handle:${track.id}`}
        trackId={track.id}
        onVerticalDrag={model.resizeTrack}
      />
    </>
  )
})

TrackContainer.propTypes = {
  model: PropTypes.objectOrObservableObject.isRequired,
  track: ReactPropTypes.shape({}).isRequired,
}

function LinearGenomeView(props) {
  const { model } = props
  const { id, staticBlocks, tracks, bpPerPx, controlsWidth, offsetPx } = model
  const scaleBarHeight = 32
  const session = getSession(model)
  const classes = useStyles()
  /*
   * NOTE: offsetPx is the total offset in px of the viewing window into the
   * whole set of concatenated regions. this number is often quite large.
   */
  const style = {
    display: 'grid',
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
              <ToggleButton
                onClick={model.activateTrackSelector}
                title="select tracks"
                className={classes.toggleButton}
                selected={
                  session.visibleDrawerWidget &&
                  session.visibleDrawerWidget.id ===
                    'hierarchicalTrackSelector' &&
                  session.visibleDrawerWidget.view.id === model.id
                }
                value="track_select"
                data_testid="track_select"
              >
                <Icon fontSize="small">line_style</Icon>
              </ToggleButton>
            </>
          )}
        </div>

        <Rubberband
          style={{
            gridColumn: 'blocks',
            gridRow: 'scale-bar',
          }}
          offsetPx={offsetPx}
          blocks={staticBlocks}
          bpPerPx={bpPerPx}
          model={model}
        >
          <ScaleBar
            height={scaleBarHeight}
            bpPerPx={bpPerPx}
            blocks={staticBlocks}
            offsetPx={offsetPx}
            horizontallyFlipped={model.horizontallyFlipped}
          />
        </Rubberband>

        <div
          className={classes.zoomControls}
          style={{
            right: 4,
            zIndex: 1000,
          }}
        >
          <ZoomControls model={model} controlsHeight={scaleBarHeight} />
        </div>
        {tracks.map(track => (
          <TrackContainer key={track.id} model={model} track={track} />
        ))}
      </div>
    </div>
  )
}
LinearGenomeView.propTypes = {
  model: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(LinearGenomeView)
