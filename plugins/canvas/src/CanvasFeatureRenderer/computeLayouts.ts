import { readConfObject } from '@jbrowse/core/configuration'
import { calculateLayoutBounds } from '@jbrowse/core/util'

import { createFeatureFloatingLabels } from './floatingLabels'
import { layoutFeature } from './simpleLayout'

import type { RenderConfigContext } from './renderConfig'
import type { LayoutRecord } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

const yPadding = 5

export function computeLayouts({
  features,
  bpPerPx,
  region,
  config,
  configContext,
  layout,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  layout: BaseLayout<unknown>
}): LayoutRecord[] {
  const reversed = region.reversed || false
  const layoutRecords: LayoutRecord[] = []

  const {
    displayMode,
    transcriptTypes,
    containerTypes,
    showLabels,
    showDescriptions,
    showSubfeatureLabels,
    subfeatureLabelPosition,
    fontHeight,
    labelAllowed,
  } = configContext

  for (const feature of features.values()) {
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      config,
      configContext,
    })

    const totalLayoutWidth = featureLayout.totalLayoutWidth
    const totalLayoutHeight = featureLayout.totalLayoutHeight
    const totalFeatureHeight = featureLayout.totalFeatureHeight

    const name = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )

    const floatingLabels = createFeatureFloatingLabels({
      feature,
      config,
      configContext,
      nameColor: 'black',
      descriptionColor: 'blue',
    })

    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const layoutWidthBp = totalLayoutWidth * bpPerPx
    const [layoutStart, layoutEnd] = calculateLayoutBounds(
      featureStart,
      featureEnd,
      layoutWidthBp,
      reversed,
    )

    const topPx = layout.addRect(
      feature.id(),
      layoutStart,
      layoutEnd,
      totalLayoutHeight + yPadding,
      feature,
      {
        label: name,
        description,
        refName: feature.get('refName'),
        floatingLabels,
        totalFeatureHeight,
        totalLayoutWidth,
        featureWidth: featureLayout.width,
      },
    )

    if (topPx !== null) {
      layoutRecords.push({
        feature,
        layout: featureLayout,
        topPx,
      })
    }
  }

  return layoutRecords
}
