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
    position: 'absolute',
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

const RenderedBlock = observer(({ block, viewModel, state }) => {
  const classes = useStyles()
  return (
    <Block block={block} model={viewModel}>
      {state && state.ReactComponent ? (
        <state.ReactComponent model={state} />
      ) : null}
      {state && state.maxHeightReached ? (
        <div
          className={classes.heightOverflowed}
          style={{
            top: state.data.layout.totalHeight - 16,
            height: 16,
          }}
        >
          Max height reached
        </div>
      ) : null}
    </Block>
  )
})

function TrackBlocks({
  model,
  viewModel,
  blockState,
}: {
  model: Instance<BlockBasedTrackStateModel>
  viewModel: Instance<LinearGenomeViewStateModel>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockState: Record<string, any>
}) {
  const classes = useStyles()
  const { blockDefinitions } = model
  return (
    <div data-testid="Block" className={classes.trackBlocks}
      style={{
        left: blockDefinitions.offsetPx - viewModel.offsetPx,
      }}
    >
      {blockDefinitions.map((block: BaseBlock) => {
        if (block instanceof ContentBlock) {
          const state = blockState.get(block.key)
          return (
            <RenderedBlock
              key={`${model.id}-${block.key}`}
              block={block}
              viewModel={viewModel}
              state={state}
            />
          )
        }
        if (block instanceof ElidedBlock) {
          return (
            <ElidedBlockMarker
              key={`${model.id}-${block.key}`}
              width={block.widthPx}
              offset={block.offsetPx - viewModel.offsetPx}
            />
          )
        }
        if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockMarker
              key={block.key}
              block={block}
              model={viewModel}
            />
          )
        }
        throw new Error(`invalid block type ${typeof block}`)
      })}
    </div>
  )
}

TrackBlocks.propTypes = {
  blockState: PropTypes.observableMap.isRequired,
  model: PropTypes.observableObject.isRequired,
  viewModel: PropTypes.observableObject.isRequired,
}

export default observer(TrackBlocks)
