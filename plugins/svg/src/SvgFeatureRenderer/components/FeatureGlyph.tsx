import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getContainingView, Region } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { isStateTreeNode } from 'mobx-state-tree'
import FeatureLabel from './FeatureLabel'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import type { DisplayModel } from './util'

function FeatureGlyph(props: {
  feature: Feature
  rootLayout: SceneGraph
  config: AnyConfigurationModel
  name: string
  description: string
  shouldShowName: boolean
  shouldShowDescription: boolean
  fontHeight: number
  allowedWidthExpansion: number
  displayModel: DisplayModel
  selected?: boolean
  reversed?: boolean
  topLevel?: boolean
  region: Region
}) {
  const {
    feature,
    rootLayout,
    selected,
    config,
    name,
    description,
    shouldShowName,
    shouldShowDescription,
    reversed,
    displayModel,
    region,
  } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  }
  const { GlyphComponent } = featureLayout.data || {}

  let offsetPx = rootLayout.getSubRecord('nameLabel')?.absolute.left || 0
  if (isStateTreeNode(displayModel)) {
    const view = getContainingView(displayModel)
    // @ts-ignore
    const { dynamicBlocks, offsetPx: viewOffsetPx } = view

    const { start: viewStart } = dynamicBlocks?.contentBlocks[0] || {}
    // @ts-ignore
    const blockOffsetPx = view.bpToPx({
      refName: region.refName,
      coord: region.start,
    })?.offsetPx
    const baseOffsetPx = viewOffsetPx - blockOffsetPx
    if (
      feature.get('start') < viewStart + featureLayout.width &&
      viewStart - featureLayout.width < feature.get('end')
    ) {
      offsetPx = baseOffsetPx
    }
  }
  return (
    <>
      <GlyphComponent
        key={`glyph-${feature.id()}`}
        featureLayout={featureLayout}
        selected={selected}
        {...props}
      />
      {shouldShowName ? (
        <FeatureLabel
          text={name}
          x={offsetPx}
          y={rootLayout.getSubRecord('nameLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'nameColor'], { feature })}
          reversed={reversed}
          featureWidth={featureLayout.width}
          {...props}
        />
      ) : null}
      {shouldShowDescription ? (
        <FeatureLabel
          text={description}
          x={offsetPx}
          y={rootLayout.getSubRecord('descriptionLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'descriptionColor'], {
            feature,
          })}
          featureWidth={featureLayout.width}
          reversed={reversed}
          {...props}
        />
      ) : null}
    </>
  )
}

export default observer(FeatureGlyph)
