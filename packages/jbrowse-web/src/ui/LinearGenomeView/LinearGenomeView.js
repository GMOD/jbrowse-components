import React, { Component } from 'react'
import PropTypes from 'prop-types'
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
TrackResizeHandle.propTypes = { trackId: PropTypes.string.isRequired }

export default class LinearGenomeView extends Component {
  defaultProps = {
    blocks: [],
    tracks: [],
  }

  propTypes = {
    blocks: PropTypes.arrayOf(PropTypes.object),
    tracks: PropTypes.arrayOf(PropTypes.object),
    bpPerPx: PropTypes.number.isRequired,
    offsetPx: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    onHorizontalScroll: PropTypes.func.isRequired,
    controlsWidth: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props)

    this.horizontalScroll = this.horizontalScroll.bind(this)
  }

  horizontalScroll(distance) {
    const { onHorizontalScroll } = this.props
    onHorizontalScroll(distance)
  }

  render() {
    const scaleBarHeight = 22
    const {
      blocks,
      tracks,
      bpPerPx,
      offsetPx,
      width,
      controlsWidth,
    } = this.props
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
      <div className="LinearGenomeView" style={style}>
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
          offset={offsetPx}
        />
        {tracks.map(track => [
          <div
            className="controls track-controls"
            key="handle:track.id"
            style={{ gridRow: track.id, gridColumn: 'controls' }}
          >
            {track.name || track.id}
          </div>,
          <TrackBlocks
            blocks={blocks}
            trackId={track.id}
            offsetPx={offsetPx}
            bpPerPx={bpPerPx}
            onHorizontalScroll={this.horizontalScroll}
          />,
          <TrackResizeHandle trackId={track.id} />,
        ])}
      </div>
    )
  }
}
