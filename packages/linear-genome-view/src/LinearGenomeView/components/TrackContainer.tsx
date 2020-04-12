import { getConf } from '@gmod/jbrowse-core/configuration'
import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import {
  useDebouncedCallback,
  getContainingView,
} from '@gmod/jbrowse-core/util'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance, isAlive } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel, RESIZE_HANDLE_HEIGHT } from '..'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'
import TrackLabel from './TrackLabel'
import TrackRenderingContainer from './TrackRenderingContainer'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
  },
  resizeHandle: {
    height: RESIZE_HANDLE_HEIGHT,
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 2,
  },
  overlay: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    zIndex: 3,
    borderRadius: theme.shape.borderRadius,
  },
  renderingComponentContainer: {
    position: 'relative',
    height: '100%',
  },
  trackLabel: {
    position: 'absolute',
    zIndex: 3,
    margin: theme.spacing(1),
  },
}))

function TrackContainer(props: {
  model: LGV
  track: Instance<BaseTrackStateModel>
}) {
  const classes = useStyles()
  const { model, track } = props
  const {
    bpPerPx,
    offsetPx,
    horizontalScroll,
    draggingTrackId,
    moveTrack,
  } = model
  function onDragEnter() {
    if (
      draggingTrackId !== undefined &&
      isAlive(track) &&
      draggingTrackId !== track.id
    ) {
      moveTrack(draggingTrackId, track.id)
    }
  }
  const debouncedOnDragEnter = useDebouncedCallback(onDragEnter, 100)
  const { RenderingComponent } = track
  const view = getContainingView(track)
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== track.id
  return (
    <div className={classes.root}>
      <TrackLabel track={track} className={classes.trackLabel} />
      <TrackRenderingContainer
        trackId={track.id}
        trackHeight={track.height}
        onHorizontalScroll={horizontalScroll}
        setScrollTop={track.setScrollTop}
        onDragEnter={debouncedOnDragEnter}
        data-testid={`trackRenderingContainer-${view.id}-${getConf(
          track,
          'trackId',
        )}`}
      >
        <div className={classes.renderingComponentContainer}>
          <RenderingComponent
            model={track}
            offsetPx={offsetPx}
            bpPerPx={bpPerPx}
            blockState={{}}
            onHorizontalScroll={horizontalScroll}
          />
        </div>
      </TrackRenderingContainer>
      <div
        className={classes.overlay}
        style={{
          height: track.height,
          background: dimmed ? 'rgba(0, 0, 0, 0.4)' : undefined,
        }}
        onDragEnter={debouncedOnDragEnter}
      />
      <ResizeHandle
        onDrag={track.resizeHeight}
        className={classes.resizeHandle}
      />
    </div>
  )
}

export default observer(TrackContainer)
