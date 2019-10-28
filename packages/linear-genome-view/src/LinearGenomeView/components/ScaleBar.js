import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import Block from '../../BasicTrack/components/Block'
import Ruler from './Ruler'

const useStyles = makeStyles((/* theme */) => ({
  scaleBarContainer: {
    position: 'relative',
    display: 'block',
  },
  scaleBar: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    position: 'absolute',
    display: 'flex',
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
}))

function findBlockContainingLeftSideOfView(offsetPx, blockSet) {
  const blocks = blockSet.getBlocks()
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.offsetPx <= offsetPx && block.offsetPx + block.widthPx > offsetPx)
      return block
  }
  return undefined
}

const RenderedBlock = observer(
  ({ block, model, height, blockContainingLeftEndOfView }) => {
    return (
      <Block block={block}>
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
  },
)
function ScaleBar({ model, height }) {
  const classes = useStyles()
  const blockContainingLeftEndOfView = findBlockContainingLeftSideOfView(
    model.offsetPx,
    model.staticBlocks,
  )
  const offsetBlockPx = model.staticBlocks.offsetPx
  const width = model.staticBlocks.totalWidthPx

  return (
    <div className={classes.scaleBarContainer}>
      <div
        className={classes.scaleBar}
        style={{ left: offsetBlockPx - model.offsetPx, width }}
      >
        {model.staticBlocks.map(block => {
          return (
            <RenderedBlock
              key={block.key}
              block={block}
              model={model}
              blockContainingLeftEndOfView={blockContainingLeftEndOfView}
              height={height}
            />
          )
        })}
        {// put in a floating ref label
        blockContainingLeftEndOfView ? (
          <div className={classes.refLabel}>
            {blockContainingLeftEndOfView.refName}
          </div>
        ) : null}
      </div>
    </div>
  )
}
ScaleBar.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  height: PropTypes.number.isRequired,
}

export default observer(ScaleBar)
