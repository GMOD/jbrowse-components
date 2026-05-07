import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from './Block.tsx'
import MaxHeightReached from './MaxHeightReachedIndicator.tsx'

import type { BlockModel } from '../models/serverSideRenderedBlock.ts'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()({
  interRegionPadding: {
    background: 'none',
  },
})

const ContentBlockBody = observer(function ContentBlockBody({
  state,
}: {
  state: BlockModel
}) {
  return (
    <>
      <state.ReactComponent model={state} />
      {state.maxHeightReached && state.layout ? (
        <MaxHeightReached top={state.layout.getTotalHeight() - 16} />
      ) : null}
    </>
  )
})

const RenderedBlocks = observer(function RenderedBlocks({
  model,
}: {
  model: {
    id: string
    blockDefinitions: BlockSet
    blockState: { get: (key: string) => BlockModel | undefined }
  }
}) {
  const { classes } = useStyles()
  const { blockDefinitions, blockState } = model
  return blockDefinitions.map(block => {
    const key = `${model.id}-${block.key}`
    switch (block.type) {
      case 'ContentBlock': {
        const state = blockState.get(block.key)
        return (
          <ContentBlockComponent block={block} key={key}>
            {state ? <ContentBlockBody state={state} /> : null}
          </ContentBlockComponent>
        )
      }
      case 'ElidedBlock': {
        return <ElidedBlockComponent key={key} width={block.widthPx} />
      }
      case 'InterRegionPaddingBlock': {
        return (
          <InterRegionPaddingBlockComponent
            key={key}
            width={block.widthPx}
            className={classes.interRegionPadding}
            boundary={block.variant === 'boundary'}
          />
        )
      }
      default:
        throw new Error(`invalid block type ${JSON.stringify(block)}`)
    }
  })
})

export default RenderedBlocks
