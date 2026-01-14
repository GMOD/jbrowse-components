import { readConfObject } from '@jbrowse/core/configuration'
import { createSubfeatureLabelMetadata } from '@jbrowse/plugin-linear-genome-view'

import { createTranscriptFloatingLabel } from '../floatingLabels.ts'
import { builtinGlyphs } from '../glyphs/index.ts'

import type { FloatingLabelData } from '../floatingLabels.ts'
import type { RenderConfigContext } from '../renderConfig.ts'
import type { FeatureLayout, SubfeatureInfo } from '../types.ts'
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

// Unified interface for glyphs that provide custom mouseover
interface GlyphWithMouseover {
  getSubfeatureMouseover?: (feature: Feature) => string | undefined
}

function findMatchingGlyph(
  feature: Feature,
  configContext: RenderConfigContext,
  pluginManager?: PluginManager,
): GlyphWithMouseover | undefined {
  // Check builtin glyphs first
  const builtinMatch = builtinGlyphs.find(
    glyph => glyph.hasIndexableChildren && glyph.match(feature, configContext),
  )
  if (builtinMatch) {
    return builtinMatch
  }

  // Check pluggable glyphs
  if (pluginManager) {
    const glyphTypes = pluginManager.getGlyphTypes()
    const sortedGlyphs = [...glyphTypes].sort((a, b) => b.priority - a.priority)
    const pluggableMatch = sortedGlyphs.find(
      glyph => glyph.match?.(feature) && glyph.getChildFeatures,
    )
    if (pluggableMatch) {
      return pluggableMatch
    }
  }

  return undefined
}

/**
 * Build subfeature index for hit detection and floating labels.
 *
 * This unified function handles:
 * 1. Gene+transcript patterns (filters by transcriptTypes)
 * 2. Builtin glyphs with hasIndexableChildren (e.g., MatureProteinRegion)
 * 3. Pluggable glyphs with getChildFeatures
 *
 * All use the children's actual layout positions.
 */
export function buildChildrenIndex({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  configContext,
  pluginManager,
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
  configContext: RenderConfigContext
  pluginManager?: PluginManager
  subfeatureLabels: string
  transcriptTypes: string[]
  labelColor: string
  parentTooltip: string
}) {
  addChildrenRecursive({
    layout,
    featureLayout,
    subfeatureCoords,
    subfeatureInfos,
    config,
    configContext,
    pluginManager,
    subfeatureLabels,
    transcriptTypes,
    labelColor,
    parentTooltip,
  })
}

function addChildrenRecursive({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  configContext,
  pluginManager,
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
  configContext: RenderConfigContext
  pluginManager?: PluginManager
  subfeatureLabels: string
  transcriptTypes: string[]
  labelColor: string
  parentTooltip: string
}) {
  const feature = featureLayout.feature
  const featureType = feature.get('type')
  const isGene = featureType === 'gene'

  // Check if a glyph wants its children indexed
  const matchingGlyph = findMatchingGlyph(feature, configContext, pluginManager)

  // Check for gene+transcript pattern
  const hasTranscriptChildren =
    isGene &&
    featureLayout.children.some(child =>
      transcriptTypes.includes(child.feature.get('type')),
    )

  const shouldIndexChildren = matchingGlyph || hasTranscriptChildren
  const showSubfeatureLabels = subfeatureLabels !== 'none'

  if (shouldIndexChildren) {
    for (const child of featureLayout.children) {
      const childFeature = child.feature
      const childType = childFeature.get('type') as string

      // For gene+transcript pattern, only index transcripts
      if (hasTranscriptChildren && !matchingGlyph) {
        if (!transcriptTypes.includes(childType)) {
          continue
        }
      }

      // Use child's actual layout position
      const leftPx = child.x
      const rightPx = child.x + child.totalLayoutWidth
      const topPx = child.y
      const bottomPx = child.y + child.totalLayoutHeight

      subfeatureCoords.push(leftPx, topPx, rightPx, bottomPx)

      // Get mouseover text - prefer glyph's custom mouseover
      const glyphMouseover =
        matchingGlyph?.getSubfeatureMouseover?.(childFeature)
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

      // Create floating labels
      const floatingLabels: FloatingLabelData[] = []
      if (showSubfeatureLabels && displayLabel) {
        const label = createTranscriptFloatingLabel({
          displayLabel,
          featureHeight: child.height,
          subfeatureLabels,
          color: labelColor,
          parentFeatureId: featureLayout.feature.id(),
          subfeatureId: childFeature.id(),
          tooltip: matchingGlyph ? displayLabel : parentTooltip,
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
        showSubfeatureLabels && floatingLabels.length > 0
          ? createSubfeatureLabelMetadata({
              refName: childFeature.get('refName'),
              floatingLabels,
              totalFeatureHeight: child.height,
              totalLayoutWidth: child.totalLayoutWidth,
              actualTopPx: topPx,
              featureWidth: child.width,
              featureStartBp: childStart,
              featureEndBp: childEnd,
            })
          : { refName: childFeature.get('refName') },
      )
    }
  }

  // Recurse into children
  for (const child of featureLayout.children) {
    addChildrenRecursive({
      layout,
      featureLayout: child,
      subfeatureCoords,
      subfeatureInfos,
      config,
      configContext,
      pluginManager,
      subfeatureLabels,
      transcriptTypes,
      labelColor,
      parentTooltip,
    })
  }
}
