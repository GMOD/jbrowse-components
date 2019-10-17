import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import Block from '../../BasicTrack/components/Block'
import Ruler from './Ruler'
import { LinearGenomeViewStateModel } from '..'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
  BlockSet,
} from '../../BasicTrack/util/blockTypes'

import {
  ElidedBlockMarker,
  InterRegionPaddingBlockMarker,
} from '../../BasicTrack/components/MarkerBlocks'

const useStyles = makeStyles((/* theme */) => ({
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
}))

function findBlockContainingLeftSideOfView(
  offsetPx: number,
  blockSet: BlockSet,
) {
  const blocks = blockSet.getBlocks()
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.offsetPx <= offsetPx && block.offsetPx + block.widthPx > offsetPx)
      return block
  }
  return blocks[0]
}

type LGV = Instance<LinearGenomeViewStateModel>
function ScaleBar({ model, height }: { model: LGV; height: number }) {
  const classes = useStyles()
  const blockContainingLeftEndOfView = findBlockContainingLeftSideOfView(
    model.offsetPx,
    model.staticBlocks,
  )

  return (
    <div className={classes.scaleBar}>
      {model.staticBlocks.map(block => {
        if (block instanceof ContentBlock) {
          return (
            <Block key={block.offsetPx} block={block} model={model}>
              <svg height={height} width={block.widthPx}>
                <Ruler
                  region={block}
                  bpPerPx={model.bpPerPx}
                  flipped={model.horizontallyFlipped}
                />
              </svg>
            </Block>
          )
        }
        if (block instanceof ElidedBlock) {
          return (
            <ElidedBlockMarker
              key={block.key}
              width={block.widthPx}
              offset={block.offsetPx - model.offsetPx}
            />
          )
        }
        if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockMarker
              key={block.key}
              block={block}
              model={model}
            />
          )
        }
        return null
      })}
      {blockContainingLeftEndOfView ? (
        <div
          style={{
            left: Math.max(
              0,
              blockContainingLeftEndOfView.offsetPx - model.offsetPx,
            ),
          }}
          className={classes.refLabel}
        >
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
  height: PropTypes.number.isRequired,
}

export default observer(ScaleBar)
