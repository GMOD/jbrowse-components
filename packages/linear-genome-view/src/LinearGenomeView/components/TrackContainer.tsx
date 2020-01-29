import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import { useDebouncedCallback } from '@gmod/jbrowse-core/util'
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance, isAlive } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel } from '..'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'
import TrackRenderingContainer from './TrackRenderingContainer'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  controls: {
    borderRight: '1px solid gray',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  trackControls: {
    whiteSpace: 'normal',
  },
}))

function TrackContainer(props: {
  model: LGV
  track: Instance<BaseTrackStateModel>
}) {
  const { model, track } = props
  const classes = useStyles()
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
  const { RenderingComponent, ControlsComponent } = track
  // Since the ControlsComponent and the TrackRenderingContainer are next to
  // each other in a grid, we add `onDragEnter` to both of them so the user
  // can drag the track on to the controls or the track itself.
  return (
    <>
      <ControlsComponent
        track={track}
        view={model}
        onConfigureClick={track.activateConfigurationUI}
        className={clsx(classes.controls, classes.trackControls)}
        style={{ gridRow: `track-${track.id}`, gridColumn: 'controls' }}
        onDragEnter={debouncedOnDragEnter}
      />
      <TrackRenderingContainer
        trackId={track.id}
        trackHeight={track.height}
        onHorizontalScroll={horizontalScroll}
        setScrollTop={track.setScrollTop}
        onDragEnter={debouncedOnDragEnter}
        dimmed={draggingTrackId !== undefined && draggingTrackId !== track.id}
      >
        <RenderingComponent
          model={track}
          offsetPx={offsetPx}
          bpPerPx={bpPerPx}
          blockState={{}}
          onHorizontalScroll={horizontalScroll}
        />
      </TrackRenderingContainer>
      <ResizeHandle
        onDrag={track.resizeHeight}
        style={{
          gridRow: `resize-${track.id}`,
          gridColumn: 'span 2',
          background: '#ccc',
          boxSizing: 'border-box',
          borderTop: '1px solid #fafafa',
        }}
      />
    </>
  )
}

export default observer(TrackContainer)
