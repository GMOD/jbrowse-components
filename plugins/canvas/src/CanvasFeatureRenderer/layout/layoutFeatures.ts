import { readConfObject } from '@jbrowse/core/configuration'

import { createFeatureFloatingLabels } from '../floatingLabels.ts'
import { layoutFeature } from './layoutFeature.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { LayoutRecord } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

const yPadding = 5

export function layoutFeatures({
  features,
  bpPerPx,
  region,
  configContext,
  layout,
  pluginManager,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  configContext: RenderConfigContext
  layout: BaseLayout<unknown>
  pluginManager: PluginManager
}): LayoutRecord[] {
  const reversed = region.reversed || false
  const layoutRecords: LayoutRecord[] = []
  const { config } = configContext

  for (const feature of features.values()) {
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      configContext,
      pluginManager,
    })

    const totalLayoutWidth = featureLayout.totalLayoutWidth
    const totalLayoutHeight = featureLayout.totalLayoutHeight

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
      name,
      description,
    })

    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const leftPaddingBp = featureLayout.leftPadding * bpPerPx
    const rightPaddingBp =
      (totalLayoutWidth - featureLayout.width - featureLayout.leftPadding) *
      bpPerPx

    // In reversed mode: visual left = genomic end, visual right = genomic start
    // leftPadding (visual left) should expand genomic end
    // rightPadding (visual right, including labels) should expand genomic start
    // In normal mode: visual left = genomic start, visual right = genomic end
    let layoutStart, layoutEnd
    if (reversed) {
      layoutStart = featureStart - rightPaddingBp
      layoutEnd = featureEnd + leftPaddingBp
    } else {
      layoutStart = featureStart - leftPaddingBp
      layoutEnd = featureEnd + rightPaddingBp
    }

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
        totalFeatureHeight: featureLayout.height,
        totalLayoutWidth,
        featureWidth: featureLayout.width,
        featureStartBp: featureStart,
        featureEndBp: featureEnd,
      },
    )

    if (topPx !== null) {
      layoutRecords.push({
        feature,
        layout: featureLayout,
        topPx,
        label: name,
        description,
      })
    }
  }

  return layoutRecords
}
