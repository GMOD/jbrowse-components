import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { BlockBasedTrackStateModel } from '../blockBasedTrackModel'
import { LinearGenomeViewStateModel } from '../../LinearGenomeView'
import {
  BaseBlock,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '../util/blockTypes'
import Block from './Block'

import {
  ElidedBlockMarker,
  InterRegionPaddingBlockMarker,
} from './MarkerBlocks'

const useStyles = makeStyles({
  trackBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    background: '#404040',
    display: 'flex',
    minHeight: '100%',
  },
  heightOverflowed: {
    position: 'absolute',
    color: 'rgb(77,77,77)',
    borderBottom: '2px solid rgb(77,77,77)',
    textShadow: 'white 0px 0px 1px',
    whiteSpace: 'nowrap',
    width: '100%',
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 2000,
    boxSizing: 'border-box',
  },
})
const RenderedBlocks = observer(
  (props: { model: Instance<BlockBasedTrackStateModel> }) => {
    const { model } = props
    const classes = useStyles()
    const { blockDefinitions, blockState } = model
    if (blockDefinitions.blocks.length > 0) {
      console.log(blockDefinitions.blocks[0].offsetPx)
    }
    return (
      <>
        {blockDefinitions.blocks.length > 0 ? (
          <div style={{ width: blockDefinitions.blocks[0].offsetPx }} />
        ) : null}
        {blockDefinitions.map((block: BaseBlock) => {
          if (block instanceof ContentBlock) {
            const state = blockState.get(block.key)
            return (
              <Block block={block} key={`${model.id}-${block.key}`}>
                {state && state.ReactComponent ? (
                  <state.ReactComponent model={state} />
                ) : null}
                {state && state.maxHeightReached ? (
                  <div
                    className={classes.heightOverflowed}
                    style={{
                      top: state.data.layout.totalHeight - 16,
                      pointerEvents: 'none',
                      height: 16,
                    }}
                  >
                    Max height reached
                  </div>
                ) : null}
              </Block>
            )
          }
          if (block instanceof ElidedBlock) {
            return (
              <ElidedBlockMarker
                key={`${model.id}-${block.key}`}
                width={block.widthPx}
              />
            )
          }
          if (block instanceof InterRegionPaddingBlock) {
            return (
              <InterRegionPaddingBlockMarker
                key={block.key}
                width={block.widthPx}
              />
            )
          }
          throw new Error(`invalid block type ${typeof block}`)
        })}
      </>
    )
  },
)
function TrackBlocks({
  model,
  viewModel,
}: {
  model: Instance<BlockBasedTrackStateModel>
  viewModel: Instance<LinearGenomeViewStateModel>
}) {
  const classes = useStyles()
  const { blockDefinitions } = model

  return (
    <>
      <div data-testid="Block" className={classes.trackBlocks}>
        <RenderedBlocks model={model} />
      </div>
    </>
  )
}

TrackBlocks.propTypes = {
  model: PropTypes.observableObject.isRequired,
  viewModel: PropTypes.observableObject.isRequired,
}

export default observer(TrackBlocks)
