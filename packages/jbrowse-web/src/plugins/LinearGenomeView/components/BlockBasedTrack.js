import { withStyles } from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import Block from './Block'

const styles = (/* theme */) => ({
  track: {
    color: 'white',
    position: 'relative',
    height: '100%',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: '#555',
    overflow: 'hidden',
  },
})

function BlockBasedTrack({ classes, ...otherProps }) {
  const { model, blockDefinitions, offsetPx, bpPerPx } = otherProps
  return (
    <div className={classes.track}>
      {blockDefinitions.map(block => {
        const state = model.blockState.get(block.key)
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

BlockBasedTrack.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  model: PropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(BlockBasedTrack))
