import { withStyles } from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import Block from './Block'

const styles = {
  trackBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    position: 'relative',
    background: '#555',
    overflow: 'hidden',
    height: '100%',
  },
}

@withStyles(styles)
@observer
class TrackBlocks extends Component {
  static propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
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
    const {
      classes,
      blockDefinitions,
      offsetPx,
      bpPerPx,
      blockState,
    } = this.props
    return (
      <div className={classes.trackBlocks}>
        {blockDefinitions.map(block => {
          const state = blockState.get(block.key)
          const comp = (
            <Block
              leftBorder={block.isLeftEndOfDisplayedRegion}
              rightBorder={block.isRightEndOfDisplayedRegion}
              start={block.start}
              end={block.end}
              refName={block.refName}
              width={block.widthPx}
              key={block.key}
              offset={offsetPx}
              bpPerPx={bpPerPx}
            >
              {state && state.reactComponent ? (
                <state.reactComponent model={state} />
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
