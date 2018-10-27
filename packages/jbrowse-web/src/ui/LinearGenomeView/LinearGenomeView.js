import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { inject, observer, PropTypes } from 'mobx-react'
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
          offsetPx={offsetPx}
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
            blocks={blocks}
            trackId={track.id}
            offsetPx={offsetPx}
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
