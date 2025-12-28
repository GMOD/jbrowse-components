import { readConfObject } from '@jbrowse/core/configuration'

import { createTranscriptFloatingLabel } from './floatingLabels'
import { builtinGlyphs } from './glyphs'

import type { FloatingLabelData } from './floatingLabels'
import type { FeatureLayout, Glyph, SubfeatureInfo } from './types'
import type { RenderConfigContext } from './renderConfig'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

/**
 * Convert a layout from local coordinates to canvas coordinates.
 * During layout, children are positioned relative to their parent.
 * This function recursively resolves those to final canvas pixel positions.
 */
export function convertToCanvasCoords(
  layout: FeatureLayout,
  offsetX: number,
  offsetY: number,
): FeatureLayout {
  const canvasX = offsetX + layout.x
  const canvasY = offsetY + layout.y
  return {
    ...layout,
    x: canvasX,
    y: canvasY,
    children: layout.children.map(child =>
      convertToCanvasCoords(child, canvasX, canvasY),
    ),
  }
}

export function buildSubfeatureIndex({
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

function findMatchingBuiltinGlyph(
  feature: Feature,
  configContext: RenderConfigContext,
): Glyph | undefined {
  return builtinGlyphs.find(
    glyph => glyph.hasIndexableChildren && glyph.match(feature, configContext),
  )
}

export function buildBuiltinGlyphIndex({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  configContext,
  subfeatureLabels,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  subfeatureLabels: string
  labelColor: string
}) {
  addBuiltinGlyphSubfeaturesRecursive({
    layout,
    featureLayout,
    subfeatureCoords,
    subfeatureInfos,
    config,
    configContext,
    subfeatureLabels,
    labelColor,
  })
}

function addBuiltinGlyphSubfeaturesRecursive({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  configContext,
  subfeatureLabels,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  subfeatureLabels: string
  labelColor: string
}) {
  const feature = featureLayout.feature
  const matchingGlyph = findMatchingBuiltinGlyph(feature, configContext)

  if (matchingGlyph && featureLayout.children.length > 0) {
    const { rowMap, numRows } = computeRowAssignments(featureLayout.children)
    const rowHeight = featureLayout.height / numRows
    const parentTop = featureLayout.y
    const showSubfeatureLabels = subfeatureLabels !== 'none'

    for (const child of featureLayout.children) {
      const childFeature = child.feature
      const childType = childFeature.get('type') as string
      const row = rowMap.get(child) ?? 0

      const leftPx = child.x
      const rightPx = child.x + child.width
      const topPx = parentTop + row * rowHeight
      const bottomPx = topPx + rowHeight

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
        featureId: childFeature.id(),
        parentFeatureId: featureLayout.feature.id(),
        displayLabel,
        type: childType,
        leftPx,
        topPx,
        rightPx,
        bottomPx,
      })

      const floatingLabels: FloatingLabelData[] = []
      const padding = 1
      const boxHeight =
        subfeatureLabels === 'below'
          ? Math.floor(rowHeight / 2) - padding
          : rowHeight - padding * 2
      if (showSubfeatureLabels && displayLabel) {
        const label = createTranscriptFloatingLabel({
          displayLabel,
          featureHeight: boxHeight,
          subfeatureLabels,
          color: labelColor,
          parentFeatureId: featureLayout.feature.id(),
          tooltip: displayLabel,
        })
        if (label) {
          floatingLabels.push(label)
        }
      }

      const childStart = childFeature.get('start')
      const childEnd = childFeature.get('end')
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
                totalFeatureHeight: boxHeight,
                totalLayoutWidth: child.width,
                actualTopPx: topPx + padding,
                featureWidth: child.width,
                leftPadding: 0,
              }
            : {}),
        },
      )
    }
  }

  for (const child of featureLayout.children) {
    addBuiltinGlyphSubfeaturesRecursive({
      layout,
      featureLayout: child,
      subfeatureCoords,
      subfeatureInfos,
      config,
      configContext,
      subfeatureLabels,
      labelColor,
    })
  }
}

function sortByPosition(children: FeatureLayout[]) {
  return [...children].sort((a, b) => {
    const aStart = a.feature.get('start')
    const bStart = b.feature.get('start')
    if (aStart !== bStart) {
      return aStart - bStart
    }
    const aEnd = a.feature.get('end')
    const bEnd = b.feature.get('end')
    return bEnd - aEnd
  })
}

function computeRowAssignments(children: FeatureLayout[]) {
  const sorted = sortByPosition(children)
  const rowMap = new Map<FeatureLayout, number>()
  for (const [i, element] of sorted.entries()) {
    rowMap.set(element, i)
  }
  return { rowMap, numRows: Math.max(1, sorted.length) }
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
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  pluginManager,
  subfeatureLabels,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  pluginManager: PluginManager
  subfeatureLabels: string
  labelColor: string
}) {
  const feature = featureLayout.feature
  const matchingGlyph = findMatchingPluggableGlyph(feature, pluginManager)

  if (matchingGlyph?.getChildFeatures) {
    const childFeatures = matchingGlyph.getChildFeatures(feature, config)
    if (childFeatures.length > 0 && featureLayout.children.length > 0) {
      const { rowMap, numRows } = computeRowAssignments(featureLayout.children)
      const rowHeight = featureLayout.height / numRows
      const parentTop = featureLayout.y
      const showSubfeatureLabels = subfeatureLabels !== 'none'

      for (const child of featureLayout.children) {
        const childFeature = child.feature
        const childType = childFeature.get('type') as string
        const row = rowMap.get(child) ?? 0

        const leftPx = child.x
        const rightPx = child.x + child.width
        const topPx = parentTop + row * rowHeight
        const bottomPx = topPx + rowHeight

        subfeatureCoords.push(leftPx, topPx, rightPx, bottomPx)

        const glyphMouseover =
          matchingGlyph.getSubfeatureMouseover?.(childFeature)
        const displayLabel =
          glyphMouseover ??
          String(
            readConfObject(config, 'subfeatureMouseover', {
              feature: childFeature,
            }) || '',
          )

        subfeatureInfos.push({
          featureId: childFeature.id(),
          parentFeatureId: featureLayout.feature.id(),
          displayLabel,
          type: childType,
          leftPx,
          topPx,
          rightPx,
          bottomPx,
        })

        const floatingLabels: FloatingLabelData[] = []
        const padding = 1
        const boxHeight =
          subfeatureLabels === 'below'
            ? Math.floor(rowHeight / 2) - padding
            : rowHeight - padding * 2
        if (showSubfeatureLabels && displayLabel) {
          const label = createTranscriptFloatingLabel({
            displayLabel,
            featureHeight: boxHeight,
            subfeatureLabels,
            color: labelColor,
            parentFeatureId: featureLayout.feature.id(),
            tooltip: displayLabel,
          })
          if (label) {
            floatingLabels.push(label)
          }
        }

        const childStart = childFeature.get('start')
        const childEnd = childFeature.get('end')
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
                  totalFeatureHeight: boxHeight,
                  totalLayoutWidth: child.width,
                  actualTopPx: topPx + padding,
                  featureWidth: child.width,
                  leftPadding: 0,
                }
              : {}),
          },
        )
      }
    }
  }

  for (const child of featureLayout.children) {
    addPluggableGlyphSubfeaturesRecursive({
      layout,
      featureLayout: child,
      subfeatureCoords,
      subfeatureInfos,
      config,
      pluginManager,
      subfeatureLabels,
      labelColor,
    })
  }
}

export function buildPluggableGlyphIndex({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  pluginManager,
  subfeatureLabels,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  pluginManager: PluginManager
  subfeatureLabels: string
  labelColor: string
}) {
  addPluggableGlyphSubfeaturesRecursive({
    layout,
    featureLayout,
    subfeatureCoords,
    subfeatureInfos,
    config,
    pluginManager,
    subfeatureLabels,
    labelColor,
  })
}
