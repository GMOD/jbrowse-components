import { withStyles } from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import Block from './Block'

const styles = {
  trackBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: '#404040',
    minHeight: '100%',
  },
}

function TrackBlocks({ classes, model, offsetPx, bpPerPx, blockState }) {
  return (
    <div className={classes.trackBlocks}>
      {model.blockDefinitions.map(block => {
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
