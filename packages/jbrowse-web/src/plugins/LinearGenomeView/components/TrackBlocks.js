import React, { Component } from 'react'
import { PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import Block from './Block'

export default class TrackBlocks extends Component {
  static propTypes = {
    offsetPx: ReactPropTypes.number.isRequired,
    blocks: ReactPropTypes.arrayOf(ReactPropTypes.object).isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
  }

  constructor(props) {
    super(props)
    const { bpPerPx, blocks } = props
    this.blockWidths = (blocks || []).map(
      ({ start, end }) => Math.abs(end - start) / bpPerPx,
    )
    this.totalBlockWidths = this.blockWidths.reduce((a, b) => a + b, 0)
  }

  render() {
    const { blocks, offsetPx, bpPerPx } = this.props
    return (
      <div className="TrackBlocks">
        {(blocks || []).map(block => {
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
