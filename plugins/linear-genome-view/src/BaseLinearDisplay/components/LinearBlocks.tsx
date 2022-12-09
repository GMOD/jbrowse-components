import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '@jbrowse/core/util/blockTypes'
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from './Block'
import { LinearGenomeViewModel } from '../../LinearGenomeView'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  linearBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    position: 'absolute',
    minHeight: '100%',
    display: 'flex',
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

const RenderedBlocks = observer(function ({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const { classes } = useStyles()
  const { blockDefinitions, blockState } = model
  return (
    <>
      {blockDefinitions.map(block => {
        if (block instanceof ContentBlock) {
          const state = blockState.get(block.key)

          return (
            <ContentBlockComponent
              block={block}
              key={`${model.id}-${block.key}`}
            >
              {state && state.ReactComponent ? (
                <state.ReactComponent model={state} />
              ) : null}
              {state && state.maxHeightReached ? (
                <div
                  className={classes.heightOverflowed}
                  style={{
                    top: state.layout.getTotalHeight() - 16,
                    pointerEvents: 'none',
                    height: 16,
                  }}
                >
                  Max height reached
                </div>
              ) : null}
            </ContentBlockComponent>
          )
        }
        if (block instanceof ElidedBlock) {
          return (
            <ElidedBlockComponent
              key={`${model.id}-${block.key}`}
              width={block.widthPx}
            />
          )
        }
        if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockComponent
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
function LinearBlocks({ model }: { model: BaseLinearDisplayModel }) {
  const { classes } = useStyles()
  const { blockDefinitions } = model
  const viewModel = getContainingView(model) as LGV
  return (
    <div
      className={classes.linearBlocks}
      style={{
        left: blockDefinitions.offsetPx - viewModel.offsetPx,
      }}
    >
      <RenderedBlocks model={model} />
    </div>
  )
}

export { RenderedBlocks, useStyles }
export default observer(LinearBlocks)
