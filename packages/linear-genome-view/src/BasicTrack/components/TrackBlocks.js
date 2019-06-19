import { withStyles } from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import { ContentBlock, ElidedBlock } from '../util/blockTypes'
import Block from './Block'

const styles = {
  trackBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: '#404040',
    minHeight: '100%',
  },
  elidedBlock: {
    position: 'absolute',
    minHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
}

const ElidedBlockMarker = withStyles(styles)(function ElidedBlockMarker({
  classes,
  width,
  offset,
}) {
  return (
    <div
      className={classes.elidedBlock}
      style={{ left: `${offset}px`, width: `${width}px` }}
    />
  )
})

function TrackBlocks({ classes, model, offsetPx, bpPerPx, blockState }) {
  const { blockDefinitions } = model
  return (
    <div data-testid="Block" className={classes.trackBlocks}>
      {blockDefinitions.map(block => {
        if (block instanceof ContentBlock) {
          const state = blockState.get(block.key)
          return (
            <Block
              leftBorder={block.isLeftEndOfDisplayedRegion}
              rightBorder={block.isRightEndOfDisplayedRegion}
              start={block.start}
              end={block.end}
              refName={block.refName}
              width={block.widthPx}
              key={block.key}
              offset={block.offsetPx - offsetPx}
              bpPerPx={bpPerPx}
            >
              {state && state.reactComponent ? (
                <state.reactComponent model={state} />
              ) : (
                ' '
              )}
            </Block>
          )
        }
        if (block instanceof ElidedBlock) {
          return (
            <ElidedBlockMarker
              key={block.key}
              width={block.widthPx}
              offset={block.offsetPx - offsetPx}
            />
          )
        }
        return null
      })}
    </div>
  )
}

TrackBlocks.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  offsetPx: ReactPropTypes.number.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  blockState: PropTypes.observableMap.isRequired,
  model: PropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(TrackBlocks))
