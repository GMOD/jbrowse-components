import React from 'react'
import PropTypes from 'prop-types'
import Block from './Block'
import { assembleLocString } from '../../../util'

export default function ScaleBar({
  style,
  height,
  blocks,
  offsetPx,
  bpPerPx,
  width,
}) {
  const finalStyle = Object.assign({}, style, {
    height: `${height}px`,
    width: `${width}px`,
  })
  return (
    <div style={finalStyle} className="ScaleBar">
      {blocks.map(block => {
        const locString = assembleLocString(block)
        return (
          <Block
            refName={block.refName}
            start={block.start}
            end={block.end}
            width={block.widthPx}
            key={locString}
            offset={offsetPx}
            bpPerPx={bpPerPx}
          >
            {locString}
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
  width: PropTypes.number.isRequired,
  blocks: PropTypes.arrayOf(PropTypes.object),
  bpPerPx: PropTypes.number.isRequired,
  offsetPx: PropTypes.number.isRequired,
}
