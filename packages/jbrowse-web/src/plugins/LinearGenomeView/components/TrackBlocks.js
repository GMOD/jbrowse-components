import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Block from './Block'

export default class TrackBlocks extends Component {
  static propTypes = {
    blocks: PropTypes.arrayOf(PropTypes.object).isRequired,
    offsetPx: PropTypes.number.isRequired,
    bpPerPx: PropTypes.number.isRequired,
    // width: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props)
    const { bpPerPx } = props
    this.blockWidths = props.blocks.map(
      ({ start, end }) => Math.abs(end - start) / bpPerPx,
    )
    this.totalBlockWidths = this.blockWidths.reduce((a, b) => a + b, 0)
  }

  render() {
    const { blocks, offsetPx, bpPerPx } = this.props
    return (
      <div className="TrackBlocks">
        {blocks.map(block => {
          const { refName, start, end } = block
          const comp = (
            <Block
              start={block.start}
              end={block.end}
              refName={block.ref}
              width={block.widthPx}
              key={`${refName}:${start}..${end}`}
              offset={offsetPx}
              bpPerPx={bpPerPx}
            >
              {block.content}
            </Block>
          )
          return comp
        })}
      </div>
    )
  }
}
