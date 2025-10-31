import {
  type AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import FeatureLabel from './FeatureLabel'

import type { DisplayModel, ViewParams } from './types'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const FeatureGlyph = observer(function (props: {
  feature: Feature
  rootLayout: SceneGraph
  config: AnyConfigurationModel
  name: string
  description: string
  shouldShowName: boolean
  shouldShowDescription: boolean
  colorByCDS: boolean
  fontHeight: number
  allowedWidthExpansion: number
  exportSVG?: unknown
  displayModel?: DisplayModel
  selected?: boolean
  reversed?: boolean
  topLevel?: boolean
  region: Region
  bpPerPx: number
  viewParams: ViewParams
}) {
  const {
    config,
    name,
    description,
    shouldShowDescription,
    shouldShowName,
    feature,
    rootLayout,
    topLevel,
  } = props

  // bad or old code might not be a string id but try to assume it is

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  } else {
    const { GlyphComponent } = featureLayout.data || {}

    return (
      <g>
        <GlyphComponent featureLayout={featureLayout} {...props} />
        {shouldShowName ? (
          <FeatureLabel
            text={name}
            x={rootLayout.getSubRecord('nameLabel')?.absolute.left || 0}
            y={rootLayout.getSubRecord('nameLabel')?.absolute.top || 0}
            color={readConfObject(config, ['labels', 'nameColor'], { feature })}
            featureWidth={featureLayout.width}
            bold={topLevel}
            {...props}
          />
        ) : null}
        {shouldShowDescription ? (
          <FeatureLabel
            text={description}
            x={rootLayout.getSubRecord('descriptionLabel')?.absolute.left || 0}
            y={rootLayout.getSubRecord('descriptionLabel')?.absolute.top || 0}
            color={readConfObject(config, ['labels', 'descriptionColor'], {
              feature,
            })}
            featureWidth={featureLayout.width}
            bold={topLevel}
            {...props}
          />
        ) : null}
      </g>
    )
  }
})

export default FeatureGlyph
