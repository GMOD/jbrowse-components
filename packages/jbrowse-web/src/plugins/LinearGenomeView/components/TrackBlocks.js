import React, { Component } from 'react'
import { PropTypes, observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import Block from './Block'

import './TrackBlocks.scss'

@observer
class TrackBlocks extends Component {
  static propTypes = {
    offsetPx: ReactPropTypes.number.isRequired,
    blockDefinitions: ReactPropTypes.arrayOf(ReactPropTypes.object).isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    blockState: PropTypes.observableMap.isRequired,
  }

  constructor(props) {
    super(props)
    const { bpPerPx, blockDefinitions } = props
    this.blockWidths = blockDefinitions.map(
      ({ start, end }) => Math.abs(end - start) / bpPerPx,
    )
    this.totalBlockWidths = this.blockWidths.reduce((a, b) => a + b, 0)
  }

  render() {
    const { blockDefinitions, offsetPx, bpPerPx, blockState } = this.props
    return (
      <div className="TrackBlocks">
        {blockDefinitions.map(block => {
          const state = blockState.get(block.key)
          const comp = (
            <Block
              start={block.start}
              end={block.end}
              refName={block.refName}
              width={block.widthPx}
              key={block.key}
              offset={offsetPx}
              bpPerPx={bpPerPx}
            >
              {state && state.component ? (
                <state.component model={block} />
              ) : (
                ' '
              )}
            </Block>
          )
          return comp
        })}
      </div>
    )
  }
}

export default TrackBlocks
