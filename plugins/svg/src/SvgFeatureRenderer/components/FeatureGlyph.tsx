import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Feature, Region } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import { observer } from 'mobx-react'

//locals
import type { DisplayModel } from './util'
import FeatureLabel from './FeatureLabel'

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
  viewEnd: number
  viewStart: number
  viewOffsetPx: number
}) {
  const {
    feature,
    rootLayout,
    config,
    name,
    description,
    shouldShowName,
    shouldShowDescription,
    reversed,
    viewOffsetPx,
    viewEnd,
    viewStart,
  } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  }
  const { GlyphComponent } = featureLayout.data || {}

  let x = rootLayout.getSubRecord('nameLabel')?.absolute.left || 0
  const viewLeft = reversed ? viewEnd : viewStart

  const fstart = feature.get('start')
  const fend = feature.get('end')
  // const [fstart, fend] = reversed ? [end, start] : [start, end]
  const w = featureLayout.width
  if (reversed) {
    if (fstart < viewLeft + w && viewLeft - w < fend) {
      x = viewOffsetPx
    }
  } else {
    if (fstart < viewLeft + w && viewLeft - w < fend) {
      x = viewOffsetPx
    }
  }

  return (
    <g>
      <GlyphComponent featureLayout={featureLayout} {...props} />
      {shouldShowName ? (
        <FeatureLabel
          text={name}
          x={x}
          y={rootLayout.getSubRecord('nameLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'nameColor'], { feature })}
          featureWidth={featureLayout.width}
          {...props}
        />
      ) : null}
      {shouldShowDescription ? (
        <FeatureLabel
          text={description}
          x={x}
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
