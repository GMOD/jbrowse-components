import { readConfObject } from '@jbrowse/core/configuration'

import { createTranscriptFloatingLabel } from './floatingLabels'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FloatingLabelData } from './floatingLabels'
import type { FeatureLayout, SubfeatureInfo } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

export function adjustChildPositions(
  children: FeatureLayout[],
  xOffset: number,
  yOffset: number,
): FeatureLayout[] {
  return children.map(child => ({
    ...child,
    x: child.x + xOffset,
    y: child.y + yOffset,
    children: adjustChildPositions(child.children, xOffset, yOffset),
  }))
}

export function addSubfeaturesToLayoutAndFlatbush({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  subfeatureLabels,
  transcriptTypes,
  labelColor,
  parentTooltip,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  subfeatureLabels: string
  transcriptTypes: string[]
  labelColor: string
  parentTooltip: string
}) {
  const showSubfeatureLabels = subfeatureLabels !== 'none'
  for (const child of featureLayout.children) {
    const childFeature = child.feature
    const childType = childFeature.get('type')
    const isTranscript = transcriptTypes.includes(childType)

    if (!isTranscript) {
      continue
    }

    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    const childLeftPx = child.x
    const childRightPx = child.x + child.totalLayoutWidth
    const topPx = child.y
    const bottomPx = child.y + child.totalLayoutHeight
    subfeatureCoords.push(childLeftPx, topPx, childRightPx, bottomPx)

    const displayLabel = String(
      readConfObject(config, 'subfeatureMouseover', {
        feature: childFeature,
      }) || '',
    )

    subfeatureInfos.push({
      featureId: childFeature.id(),
      parentFeatureId: featureLayout.feature.id(),
      displayLabel,
      type: childType,
      leftPx: childLeftPx,
      topPx,
      rightPx: childRightPx,
      bottomPx,
    })

    const floatingLabels: FloatingLabelData[] = []
    if (showSubfeatureLabels) {
      const label = createTranscriptFloatingLabel({
        displayLabel,
        featureHeight: child.height,
        subfeatureLabels,
        color: labelColor,
        parentFeatureId: featureLayout.feature.id(),
        tooltip: parentTooltip,
      })
      if (label) {
        floatingLabels.push(label)
      }
    }

    layout.addRect(
      childFeature.id(),
      childStart,
      childEnd,
      bottomPx - topPx,
      childFeature,
      {
        refName: childFeature.get('refName'),
        ...(showSubfeatureLabels && floatingLabels.length > 0
          ? {
              floatingLabels,
              totalFeatureHeight: child.height,
              totalLayoutWidth: child.totalLayoutWidth,
              actualTopPx: topPx,
              featureWidth: child.width,
              leftPadding: 0,
            }
          : {}),
      },
    )
  }
}

function computeTierAssignments(children: FeatureLayout[]) {
  const sorted = [...children].sort((a, b) => {
    const aStart = a.feature.get('start') as number
    const bStart = b.feature.get('start') as number
    if (aStart !== bStart) {
      return aStart - bStart
    }
    const aEnd = a.feature.get('end') as number
    const bEnd = b.feature.get('end') as number
    return bEnd - aEnd
  })

  const tierMap = new Map<FeatureLayout, number>()
  const tierEnds: number[] = []
  let lastAssignedTier = -1

  for (const child of sorted) {
    const start = child.feature.get('start') as number
    const end = child.feature.get('end') as number

    const availableTiers: number[] = []
    for (let t = 0; t < tierEnds.length; t++) {
      if (tierEnds[t]! <= start) {
        availableTiers.push(t)
      }
    }

    let assignedTier: number
    if (availableTiers.length === 0) {
      assignedTier = tierEnds.length
      tierEnds.push(end)
    } else {
      const preferredTier = availableTiers.find(t => t !== lastAssignedTier)
      assignedTier = preferredTier ?? availableTiers[0]!
      tierEnds[assignedTier] = end
    }

    lastAssignedTier = assignedTier
    tierMap.set(child, assignedTier)
  }

  return { tierMap, numTiers: Math.max(1, tierEnds.length) }
}

function findMatchingPluggableGlyph(
  feature: Feature,
  pluginManager: PluginManager,
) {
  const glyphTypes = pluginManager.getGlyphTypes()
  const sortedGlyphs = [...glyphTypes].sort((a, b) => b.priority - a.priority)
  return sortedGlyphs.find(glyph => glyph.match?.(feature))
}

function addPluggableGlyphSubfeaturesRecursive({
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  pluginManager,
}: {
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  const feature = featureLayout.feature
  const matchingGlyph = findMatchingPluggableGlyph(feature, pluginManager)

  if (matchingGlyph?.getChildFeatures) {
    const childFeatures = matchingGlyph.getChildFeatures(feature, config)
    if (childFeatures.length > 0 && featureLayout.children.length > 0) {
      const { tierMap, numTiers } = computeTierAssignments(
        featureLayout.children,
      )
      const tierHeight = featureLayout.height / numTiers
      const parentTop = featureLayout.y

      for (const child of featureLayout.children) {
        const childFeature = child.feature
        const childType = childFeature.get('type') as string
        const tier = tierMap.get(child) ?? 0

        const leftPx = child.x
        const rightPx = child.x + child.width
        const topPx = parentTop + tier * tierHeight
        const bottomPx = topPx + tierHeight

        subfeatureCoords.push(leftPx, topPx, rightPx, bottomPx)

        const glyphMouseover = matchingGlyph.getSubfeatureMouseover?.(childFeature)
        const displayLabel =
          glyphMouseover ??
          String(
            readConfObject(config, 'subfeatureMouseover', {
              feature: childFeature,
            }) || '',
          )

        subfeatureInfos.push({
          displayLabel,
          type: childType,
        })
      }
    }
  }

  for (const child of featureLayout.children) {
    addPluggableGlyphSubfeaturesRecursive({
      featureLayout: child,
      subfeatureCoords,
      subfeatureInfos,
      config,
      pluginManager,
    })
  }
}

export function addPluggableGlyphSubfeaturesToFlatbush({
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  pluginManager,
}: {
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  addPluggableGlyphSubfeaturesRecursive({
    featureLayout,
    subfeatureCoords,
    subfeatureInfos,
    config,
    pluginManager,
  })
}
