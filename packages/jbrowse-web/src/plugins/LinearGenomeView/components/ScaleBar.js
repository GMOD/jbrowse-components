import { withStyles } from '@material-ui/core'
import React, { Component } from 'react'
import { PropTypes, ReactPropTypes } from 'prop-types'
import Block from './Block'
import { assembleLocString } from '../../../util'

import Ruler from './Ruler'

const styles = (/* theme */) => ({
  scaleBar: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    position: 'relative',
    background: '#555',
    // background: theme.palette.background.default,
    overflow: 'hidden',
    height: '100%',
    cursor: 'crosshair',
  },
  refLabel: {
    fontSize: '16px',
    position: 'absolute',
    left: '2px',
    top: '-1px',
    fontWeight: 'bold',
    background: 'white',
    // color: theme.palette.text.primary,
  },
})

function findBlockContainingLeftSideOfView(offsetPx, blocks) {
  const pxSoFar = 0
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.widthPx + pxSoFar > offsetPx && pxSoFar <= offsetPx) return block
  }
  return undefined
}

@withStyles(styles)
class ScaleBar extends Component {
  static defaultProps = {
    style: {},
    blocks: [],
    horizontallyFlipped: false,
  }

  static propTypes = {
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
    style: PropTypes.objectOf(PropTypes.any),
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    blocks: PropTypes.arrayOf(PropTypes.object),
    bpPerPx: PropTypes.number.isRequired,
    offsetPx: PropTypes.number.isRequired,
    horizontallyFlipped: PropTypes.bool,
  }

  state = {}

  onMouseDown = ({ clientX }) => {
    this.setState({
      rubberband: [clientX, clientX + 1],
    })
    window.addEventListener('mousemove', this.mouseMove, true)
    window.addEventListener('mouseup', this.mouseUp, true)
  }

  mouseUp = () => {
    // this.setState(() => ({
    //   rubberband: undefined,
    // }))
    window.removeEventListener('mouseup', this.mouseUp, true)
    window.removeEventListener('mousemove', this.mouseMove, true)
  }

  mouseMove = ({ clientX }) => {
    const { rubberband } = this.state
    if (rubberband) {
      this.setState({
        rubberband: [rubberband[0], clientX],
      })
    }
  }

  render() {
    const {
      classes,
      style,
      height,
      blocks,
      offsetPx,
      bpPerPx,
      width,
      horizontallyFlipped,
    } = this.props
    const finalStyle = Object.assign({}, style, {
      height: `${height}px`,
      width: `${width}px`,
    })

    const blockContainingLeftEndOfView = findBlockContainingLeftSideOfView(
      offsetPx,
      blocks,
    )
    const { rubberband } = this.state
    console.log(rubberband)

    return (
      <div
        style={finalStyle}
        className={classes.scaleBar}
        onMouseDown={this.onMouseDown}
        onFocus={() => {}}
        onBlur={() => {}}
        onKeyDown={() => {}}
        role="presentation"
      >
        {rubberband ? (
          <div
            id="rubberband"
            style={{
              left: `${rubberband[0] - 119}px`,
              width: `${rubberband[1] - rubberband[0]}px`,
              height: '100%',
              background: '#aad8',
              position: 'absolute',
              zIndex: 999,
            }}
          />
        ) : (
          ''
        )}
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
                <Ruler
                  region={block}
                  showRefSeqLabel={
                    !!block.isLeftEndOfDisplayedRegion &&
                    block !== blockContainingLeftEndOfView
                  }
                  bpPerPx={bpPerPx}
                  flipped={horizontallyFlipped}
                />
              </svg>
            </Block>
          )
        })}
        {// put in a floating ref label
        blockContainingLeftEndOfView ? (
          <div className={classes.refLabel}>
            {blockContainingLeftEndOfView.refName}
          </div>
        ) : null}
      </div>
    )
  }
}

export default ScaleBar
