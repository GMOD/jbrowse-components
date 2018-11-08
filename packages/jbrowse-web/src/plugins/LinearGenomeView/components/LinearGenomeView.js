import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { inject, observer, PropTypes } from 'mobx-react'

import { getConf } from '../../../configuration'

import ScaleBar from './ScaleBar'
import TrackBlocks from './TrackBlocks'

import './LinearGenomeView.scss'

const dragHandleHeight = 1
function TrackResizeHandle({ trackId }) {
  return (
    <div
      className="drag-handle drag-handle-horizontal"
      style={{
        gridRow: `resize-${trackId}`,
        gridColumn: 'span 2',
      }}
    />
  )
}
TrackResizeHandle.propTypes = { trackId: ReactPropTypes.string.isRequired }

@observer
class LinearGenomeView extends Component {
  static propTypes = {
    model: PropTypes.observableObject.isRequired,
  }

  render() {
    const scaleBarHeight = 22
    const {
      id,
      blocks,
      tracks,
      bpPerPx,
      width,
      controlsWidth,
      offsetPx,
    } = this.props.model
    // NOTE: offsetPx is the total offset in px of the viewing window into the
    // whole set of concatenated regions. this number is often quite large.
    // visibleBlocksOffsetPx is the offset of the viewing window into the set of blocks
    // that are *currently* being displayed
    const visibleBlocksOffsetPx = blocks[0] ? offsetPx - blocks[0].offsetPx : 0
    const height =
      scaleBarHeight +
      tracks.reduce((a, b) => a + b.height + dragHandleHeight, 0)
    const style = {
      width: `${width}px`,
      height: `${height}px`,
      gridTemplateRows: `[scale-bar] auto ${tracks
        .map(
          t => `[${t.id}] ${t.height}px [resize-${t.id}] ${dragHandleHeight}px`,
        )
        .join(' ')}`,
      gridTemplateColumns: `[controls] ${controlsWidth}px [blocks] auto`,
    }
    return (
      <div className="LinearGenomeView" key={`view-${id}`} style={style}>
        <div
          className="controls view-controls"
          style={{ gridRow: 'scale-bar' }}
        >
          <button type="button">select tracks</button>
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
            style={{ gridRow: track.id, gridColumn: 'controls' }}
          >
            {track.name || track.id}
          </div>,
          <TrackBlocks
            key={`track-blocks:${track.id}`}
            backgroundColor={getConf(track, 'backgroundColor')}
            blocks={blocks}
            trackId={track.id}
            offsetPx={visibleBlocksOffsetPx}
            width={width - controlsWidth}
            bpPerPx={bpPerPx}
            onHorizontalScroll={this.props.model.horizontalScroll}
          />,
          <TrackResizeHandle key={`handle:${track.id}`} trackId={track.id} />,
        ])}
      </div>
    )
  }
}

export default LinearGenomeView
