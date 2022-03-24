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
    fontHeight,
    allowedWidthExpansion,
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

    const { start: viewStart, end: viewEnd } =
      dynamicBlocks?.contentBlocks[0] || {}

    const viewLeft = reversed ? viewEnd : viewStart
    console.log({ viewLeft, viewStart, viewEnd })

    console.log({ viewStart, viewEnd })
    // @ts-ignore
    const blockOffsetPx = view.bpToPx({
      refName: region.refName,
      coord: region.start,
    })?.offsetPx
    const baseOffsetPx = viewOffsetPx - blockOffsetPx
    const fstart = feature.get('start')
    const fend = feature.get('end')
    // const [fstart, fend] = reversed ? [end, start] : [start, end]
    const w = featureLayout.width
    if (reversed) {
      if (fstart < viewLeft + w && viewLeft - w < fend) {
        offsetPx = baseOffsetPx
      }
    } else {
      if (fstart < viewLeft + w && viewLeft - w < fend) {
        offsetPx = baseOffsetPx
      }
    }
  }
  return (
    <g>
      <GlyphComponent
        featureLayout={featureLayout}
        {...props}
      />
      {shouldShowName ? (
        <FeatureLabel
          text={name}
          x={offsetPx}
          y={rootLayout.getSubRecord('nameLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'nameColor'], { feature })}
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
          {...props}
        />
      ) : null}
    </g>
  )
}

export default observer(FeatureGlyph)
