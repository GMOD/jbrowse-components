import { getConf } from '@gmod/jbrowse-core/configuration'
import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import { useDebouncedCallback } from '@gmod/jbrowse-core/util'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import { observer } from 'mobx-react'
import { Instance, isAlive } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel } from '..'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'
import TrackLabel from './TrackLabel'
import TrackRenderingContainer from './TrackRenderingContainer'

const dragHandleHeight = 3
type LGV = Instance<LinearGenomeViewStateModel>

function TrackContainer(props: {
  model: LGV
  track: Instance<BaseTrackStateModel>
}) {
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
    <div style={{ position: 'relative' }}>
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
        <TrackLabel track={track} />
        <RenderingComponent
          model={track}
          offsetPx={offsetPx}
          bpPerPx={bpPerPx}
          blockState={{}}
          onHorizontalScroll={horizontalScroll}
        />
      </TrackRenderingContainer>
      {dimmed ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: track.height,
            width: '100%',
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 10000,
          }}
          onDragEnter={debouncedOnDragEnter}
          // {...other}
        />
      ) : null}
      <ResizeHandle
        onDrag={track.resizeHeight}
        style={{
          height: dragHandleHeight,
          background: '#ccc',
          boxSizing: 'border-box',
          borderTop: '1px solid #fafafa',
        }}
      />
    </div>
  )
}

export default observer(TrackContainer)
