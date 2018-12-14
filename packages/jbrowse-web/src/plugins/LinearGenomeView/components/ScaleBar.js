import React from 'react'
import PropTypes from 'prop-types'
import Block from './Block'
import { assembleLocString } from '../../../util'

import Ruler from './Ruler'

import './ScaleBar.scss'

export default function ScaleBar({
  style,
  height,
  blocks,
  offsetPx,
  bpPerPx,
  width,
  horizontallyFlipped,
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
            <Ruler
              region={block}
              bpPerPx={bpPerPx}
              flipped={horizontallyFlipped}
            />
          </Block>
        )
      })}
    </div>
  )
}
ScaleBar.defaultProps = { style: {}, blocks: [], horizontallyFlipped: false }
ScaleBar.propTypes = {
  style: PropTypes.objectOf(PropTypes.any),
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  blocks: PropTypes.arrayOf(PropTypes.object),
  bpPerPx: PropTypes.number.isRequired,
  offsetPx: PropTypes.number.isRequired,
  horizontallyFlipped: PropTypes.bool,
}
