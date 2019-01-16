import React from 'react'
import PropTypes from 'prop-types'
import Block from './Block'
import { assembleLocString } from '../../../util'

import Ruler from './Ruler'

import './ScaleBar.scss'

function findBlockContainingLeftSideOfView(offsetPx, blocks) {
  const pxSoFar = 0
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.widthPx + pxSoFar > offsetPx && pxSoFar <= offsetPx) return block
  }
  return undefined
}

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

  const blockContainingLeftEndOfView = findBlockContainingLeftSideOfView(
    offsetPx,
    blocks,
  )

  return (
    <div style={finalStyle} className="ScaleBar">
      {blocks.map(block => {
        const locString = assembleLocString(block)
        return (
          <Block
            leftBorder={block.isLeftEndOfDisplayedRegion}
            rightBorder={block.isRightEndOfDisplayedRegion}
            refName={block.refName}
            start={block.start}
            end={block.end}
            width={block.widthPx}
            key={locString}
            offset={offsetPx}
            bpPerPx={bpPerPx}
          >
            <svg height={height} width={block.widthPx}>
              {/* {block.isLeftEndOfDisplayedRegion ? (
                <div className="refLabel">{block.refName}</div>
              ) : null} */}
              <Ruler
                region={block}
                bpPerPx={bpPerPx}
                flipped={horizontallyFlipped}
              />
            </svg>
          </Block>
        )
      })}
      {// put in a floating ref label
      blockContainingLeftEndOfView ? (
        <div className="refLabel floating">
          {blockContainingLeftEndOfView.refName}
        </div>
      ) : null}
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
