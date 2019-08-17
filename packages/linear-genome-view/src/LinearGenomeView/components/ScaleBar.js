import { withStyles } from '@material-ui/core'
import React from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import Block from '../../BasicTrack/components/Block'

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
    height: 32,
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

function findBlockContainingLeftSideOfView(offsetPx, blockSet) {
  const blocks = blockSet.getBlocks()
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.offsetPx <= offsetPx && block.offsetPx + block.widthPx > offsetPx)
      return block
  }
  return undefined
}

function ScaleBar({ classes, model, height }) {
  const blockContainingLeftEndOfView = findBlockContainingLeftSideOfView(
    model.offsetPx,
    model.staticBlocks,
  )

  return (
    <div className={classes.scaleBar}>
      {model.staticBlocks.map(block => {
        return (
          <Block key={block.offsetPx} block={block} model={model}>
            <svg height={height} width={block.widthPx}>
              <Ruler
                region={block}
                showRefNameLabel={
                  !!block.isLeftEndOfDisplayedRegion &&
                  block !== blockContainingLeftEndOfView
                }
                bpPerPx={model.bpPerPx}
                flipped={model.horizontallyFlipped}
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
ScaleBar.defaultProps = {
  style: {},
}
ScaleBar.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  height: PropTypes.number.isRequired,
}

export default withStyles(styles)(observer(ScaleBar))
