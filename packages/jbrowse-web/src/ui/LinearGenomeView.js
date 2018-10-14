import React from 'react'
import PropTypes from 'prop-types'
import './LinearGenomeView.scss'

function Block({ offset, content, start, end, bpPerPx }) {
  const blockWidth = Math.abs(end - start) / bpPerPx
  return (
    <div
      style={{ left: `${offset}px`, width: `${blockWidth}px` }}
      className="block"
    >
      {content}
    </div>
  )
}

Block.defaultProps = { content: undefined }
Block.propTypes = {
  offset: PropTypes.number.isRequired,
  content: PropTypes.element,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  bpPerPx: PropTypes.number.isRequired,
}

function ScaleBar({ style, height, blocks, offset, bpPerPx }) {
  const finalStyle = Object.assign({}, style, { height: `${height}px` })
  return (
    <div style={finalStyle} className="scale-bar">
      {blocks.map(block => {
        const foo = 1
        return (
          <Block
            key={`${block.refName}:${block.start}..${block.end}`}
            offset={offset}
            start={block.start}
            bpPerPx={bpPerPx}
            end={block.end}
            content={`${block.start} ${block.end}`}
          />
        )
      })}
    </div>
  )
}
ScaleBar.defaultProps = { style: {}, blocks: [] }
ScaleBar.propTypes = {
  style: PropTypes.objectOf(PropTypes.any),
  height: PropTypes.number.isRequired,
  blocks: PropTypes.arrayOf(PropTypes.object),
  offset: PropTypes.number.isRequired,
  bpPerPx: PropTypes.number.isRequired,
}

export default function LinearGenomeView({
  blocks,
  tracks,
  bpPerPx,
  offsetPx,
  width,
}) {
  const scaleBarHeight = 20
  const height = scaleBarHeight + tracks.reduce((a, b) => a + b.height, 0)
  const style = {
    width: `${width}px`,
    height: `${height}px`,
    gridTemplateRows: `[scale-bar] auto ${tracks
      .map(t => `[${t.id}] ${t.height}px`)
      .join(' ')}`,
    gridTemplateColumns: '[controls] 100px [blocks] auto',
  }
  return (
    <div className="LinearGenomeView" style={style}>
      <div className="controls view-controls">
        <button type="button">select tracks</button>
      </div>
      <ScaleBar
        style={{ gridColumn: 'blocks' }}
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
        <div
          className="track-blocks"
          key={`blocks:${track.id}`}
          style={{ gridRow: track.id, gridColumn: 'blocks' }}
        >
          {blocks.map(block => {
            const comp = (
              <Block
                key={`${block.refName}:${block.start}..${block.end}`}
                content={block.content}
                offset={offsetPx}
                bpPerPx={bpPerPx}
                start={block.start}
                end={block.end}
              />
            )
            return comp
          })}
        </div>,
      ])}
    </div>
  )
}

LinearGenomeView.defaultProps = {
  blocks: [],
  tracks: [],
}

LinearGenomeView.propTypes = {
  blocks: PropTypes.arrayOf(PropTypes.object),
  tracks: PropTypes.arrayOf(PropTypes.object),
  bpPerPx: PropTypes.number.isRequired,
  offsetPx: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
}
