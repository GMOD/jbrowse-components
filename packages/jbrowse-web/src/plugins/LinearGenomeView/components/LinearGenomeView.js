import React, { Component } from 'react'
import { values } from 'mobx'
import { inject, observer, PropTypes } from 'mobx-react'

import ScaleBar from './ScaleBar'
import TrackRenderingContainer from './TrackRenderingContainer'
import TrackResizeHandle from './TrackResizeHandle'
import { getConf } from '../../../configuration'

import './LinearGenomeView.scss'

const dragHandleHeight = 3

@inject('rootModel')
@observer
class LinearGenomeView extends Component {
  static propTypes = {
    model: PropTypes.observableObject.isRequired,
  }

  render() {
    const scaleBarHeight = 22
    const { model } = this.props
    const {
      id,
      blocks,
      tracks,
      bpPerPx,
      width,
      controlsWidth,
      offsetPx,
    } = model
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
      <div className="LinearGenomeView" key={`view-${id}`} style={style}>
        <div
          className="controls view-controls"
          style={{ gridRow: 'scale-bar' }}
        >
          <button type="button" onClick={model.activateTrackSelector}>
            select tracks
          </button>
        </div>
        <ScaleBar
          style={{ gridColumn: 'blocks', gridRow: 'scale-bar' }}
          height={scaleBarHeight}
          bpPerPx={bpPerPx}
          blocks={blocks}
          offsetPx={visibleBlocksOffsetPx}
          width={width - controlsWidth}
        />
        {tracks.map(track => [
          <div
            className="controls track-controls"
            key={`controls:${track.id}`}
            style={{ gridRow: `track-${track.id}`, gridColumn: 'controls' }}
          >
            <track.ControlsComponent track={track} view={model} />
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
    )
  }
}

export default LinearGenomeView
