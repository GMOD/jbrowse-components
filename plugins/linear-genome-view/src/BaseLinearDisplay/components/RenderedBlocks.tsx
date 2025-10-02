import { observer } from 'mobx-react'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from './Block'
import MaxHeightReached from './MaxHeightReachedIndicator'

import type { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

const RenderedBlocks = observer(function ({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const { blockDefinitions, blockState } = model
  return blockDefinitions.map(block => {
    const key = `${model.id}-${block.key}`
    if (block.type === 'ContentBlock') {
      const state = blockState.get(block.key)
      return (
        <ContentBlockComponent block={block} key={key}>
          {state?.ReactComponent ? (
            <state.ReactComponent model={state} />
          ) : null}
          {state?.maxHeightReached ? (
            <MaxHeightReached top={state.layout.getTotalHeight() - 16} />
          ) : null}
        </ContentBlockComponent>
      )
    } else if (block.type === 'ElidedBlock') {
      return <ElidedBlockComponent key={key} width={block.widthPx} />
    } else if (block.type === 'InterRegionPaddingBlock') {
      return (
        <InterRegionPaddingBlockComponent
          key={key}
          width={block.widthPx}
          style={{ background: 'none' }}
          boundary={block.variant === 'boundary'}
        />
      )
    }
    throw new Error(`invalid block type ${JSON.stringify(block)}`)
  })
})

export default RenderedBlocks
