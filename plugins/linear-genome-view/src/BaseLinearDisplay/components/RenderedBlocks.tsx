import { observer } from 'mobx-react'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from './Block'
import FeatureAccessibilityOverlay from './FeatureAccessibilityOverlay'
import MaxHeightReached from './MaxHeightReachedIndicator'

import type { BlockModel } from '../models/serverSideRenderedBlock'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'
import type { Feature } from '@jbrowse/core/util'

const RenderedBlocks = observer(function ({
  model,
}: {
  model: {
    id: string
    blockDefinitions: BlockSet
    blockState: { get: (key: string) => BlockModel | undefined }
    showAccessibleFeatureOverlay?: boolean
    setFeatureIdUnderMouse?: (featureId: string | undefined) => void
    setContextMenuFeature?: (feature: Feature | undefined) => void
    features?: { get: (id: string) => Feature | undefined }
  }
}) {
  const {
    blockDefinitions,
    blockState,
    showAccessibleFeatureOverlay,
    setFeatureIdUnderMouse,
    setContextMenuFeature,
    features,
  } = model
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
          {showAccessibleFeatureOverlay && state ? (
            <FeatureAccessibilityOverlay
              blockState={state}
              onFeatureFocus={(featureId, _feature) => {
                setFeatureIdUnderMouse?.(featureId)
              }}
              onFeatureClick={(featureId, _feature) => {
                setFeatureIdUnderMouse?.(featureId)
              }}
              onFeatureContextMenu={(featureId, feature) => {
                setFeatureIdUnderMouse?.(featureId)
                if (feature) {
                  setContextMenuFeature?.(feature)
                }
              }}
            />
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
