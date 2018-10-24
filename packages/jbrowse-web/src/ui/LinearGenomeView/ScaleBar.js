import React from 'react'
import PropTypes from 'prop-types'
import Block from './Block'

export default function ScaleBar({ style, height, blocks, offset, bpPerPx }) {
  const finalStyle = Object.assign({}, style, { height: `${height}px` })
  return (
    <div style={finalStyle} className="ScaleBar">
      {blocks.map(block => {
        const foo = 1
        return (
          <Block
            key={`${block.refName}:${block.start}..${block.end}`}
            offset={offset}
            start={block.start}
            bpPerPx={bpPerPx}
            end={block.end}
          >
            {block.start} {block.end}{' '}
          </Block>
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
