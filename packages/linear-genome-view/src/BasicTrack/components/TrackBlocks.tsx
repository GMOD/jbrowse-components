import { makeStyles } from '@material-ui/core/styles'
import { getContainingView } from '@gmod/jbrowse-core/util'
import { observer, PropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { BlockBasedTrackModel } from '../blockBasedTrackModel'
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
const RenderedBlocks = observer((props: { model: BlockBasedTrackModel }) => {
  const { model } = props
  const classes = useStyles()
  const { blockDefinitions, blockState } = model
  return (
    <>
      {blockDefinitions.map((block: BaseBlock, idx: number) => {
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
              style={{ background: 'none' }}
              boundary={block.variant === 'boundary'}
            />
          )
        }
        throw new Error(`invalid block type ${typeof block}`)
      })}
    </>
  )
})
function TrackBlocks({ model }: { model: BlockBasedTrackModel }) {
  const classes = useStyles()
  const { blockDefinitions } = model
  const viewModel = getContainingView(model) as any
  return (
    <div
      data-testid="Blockset"
      className={classes.trackBlocks}
      style={{
        left: blockDefinitions.offsetPx - viewModel.offsetPx,
      }}
    >
      <RenderedBlocks model={model} />
    </div>
  )
}

TrackBlocks.propTypes = {
  model: PropTypes.observableObject.isRequired,
  viewModel: PropTypes.observableObject.isRequired,
}

export { RenderedBlocks, useStyles }
export default observer(TrackBlocks)
