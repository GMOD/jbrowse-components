import { applyLabelDimensions } from '../labelUtils'
import { readCachedConfig } from '../renderConfig'
import { boxGlyph } from './box'
import { cdsGlyph } from './cds'
import { matureProteinRegionGlyph } from './matureProteinRegion'
import { processedTranscriptGlyph } from './processed'
import { repeatRegionGlyph } from './repeatRegion'
import { segmentsGlyph } from './segments'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
import type { RenderConfigContext } from '../renderConfig'
import type { Feature } from '@jbrowse/core/util'

// Local glyph list to avoid circular dependency with index.ts
// Order matters - more specific glyphs first
const childGlyphs: Glyph[] = [
  matureProteinRegionGlyph,
  repeatRegionGlyph,
  cdsGlyph,
  processedTranscriptGlyph,
  segmentsGlyph,
  boxGlyph,
]

function findChildGlyph(feature: Feature, configContext: RenderConfigContext): Glyph {
  return childGlyphs.find(g => g.match(feature, configContext)) ?? boxGlyph
}

const TRANSCRIPT_PADDING = 2
const CODING_TYPES = new Set(['CDS', 'cds'])

function hasCodingSubfeature(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures') || []
  return subfeatures.some(
    (sub: Feature) =>
      CODING_TYPES.has(sub.get('type')) || hasCodingSubfeature(sub),
  )
}

export const subfeaturesGlyph: Glyph = {
  type: 'Subfeatures',

  match(feature, configContext) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures') as Feature[] | undefined
    if (!subfeatures?.length) {
      return false
    }

    const { containerTypes } = configContext

    // Explicit container type
    if (containerTypes.includes(type)) {
      return true
    }

    // Top-level feature with nested subfeatures (gene-like)
    const isTopLevel = !feature.parent?.()
    const hasNestedSubfeatures = subfeatures.some(
      (f: Feature) => f.get('subfeatures')?.length,
    )
    return isTopLevel && hasNestedSubfeatures
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const { config, displayMode, featureHeight, geneGlyphMode, transcriptTypes } =
      configContext

    const featureBp = {
      start: feature.get('start') as number,
      end: feature.get('end') as number,
    }
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (featureBp.end - featureBp.start) / bpPerPx

    // Get and sort subfeatures (coding first)
    let subfeatures = [...(feature.get('subfeatures') || [])] as Feature[]
    subfeatures.sort((a, b) => {
      const aHasCDS = hasCodingSubfeature(a)
      const bHasCDS = hasCodingSubfeature(b)
      if (aHasCDS && !bHasCDS) {
        return -1
      }
      if (!aHasCDS && bHasCDS) {
        return 1
      }
      return 0
    })

    // Apply gene glyph mode filtering
    if (
      (geneGlyphMode === 'longest' || geneGlyphMode === 'longestCoding') &&
      subfeatures.length > 1
    ) {
      const transcriptSubfeatures = subfeatures.filter(sub =>
        transcriptTypes.includes(sub.get('type')),
      )
      let candidates =
        transcriptSubfeatures.length > 0 ? transcriptSubfeatures : subfeatures

      if (geneGlyphMode === 'longestCoding') {
        const codingCandidates = candidates.filter(hasCodingSubfeature)
        if (codingCandidates.length > 0) {
          candidates = codingCandidates
        }
      }

      const longest = candidates.reduce((a, b) =>
        a.get('end') - a.get('start') > b.get('end') - b.get('start') ? a : b,
      )
      subfeatures = [longest]
    }

    // Stack children vertically
    const children: FeatureLayout[] = []
    let currentYPx = 0
    const { subfeatureLabels } = configContext

    for (let i = 0; i < subfeatures.length; i++) {
      const child = subfeatures[i]!
      const childType = child.get('type')
      const isChildTranscript = transcriptTypes.includes(childType)
      const childGlyph = findChildGlyph(child, configContext)

      // Layout child using its glyph's layout function
      const childLayout = childGlyph.layout({
        ...args,
        feature: child,
        parentFeature: feature,
      })

      // Apply label dimensions to child (for transcript labels)
      applyLabelDimensions(childLayout, {
        feature: child,
        configContext,
        isNested: true,
        isTranscriptChild: isChildTranscript,
      })

      // Position relative to parent
      const childBp = {
        start: child.get('start') as number,
        end: child.get('end') as number,
      }
      const offsetBp = reversed
        ? featureBp.end - childBp.end
        : childBp.start - featureBp.start
      const xRelativePx = offsetBp / bpPerPx

      childLayout.x = xRelativePx
      childLayout.y = currentYPx

      children.push(childLayout)

      // Use totalLayoutHeight when labels are below, otherwise just height
      const useExtraHeightForLabels =
        subfeatureLabels === 'below' && isChildTranscript
      const heightForStacking = useExtraHeightForLabels
        ? childLayout.totalLayoutHeight
        : childLayout.height
      currentYPx += heightForStacking
      if (i < subfeatures.length - 1) {
        currentYPx += TRANSCRIPT_PADDING
      }
    }

    const totalHeightPx = currentYPx > 0 ? currentYPx : baseHeightPx

    return {
      feature,
      glyphType: 'Subfeatures',
      x: 0,
      y: 0,
      width: widthPx,
      height: totalHeightPx,
      totalFeatureHeight: totalHeightPx,
      totalLayoutHeight: totalHeightPx,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children,
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { children } = layout

    if (children.length === 0) {
      boxGlyph.draw(ctx, { ...layout, glyphType: 'Box' }, dc)
      return
    }

    // All coordinates are already absolute - just draw each child
    for (const childLayout of children) {
      const childGlyph = findChildGlyph(childLayout.feature, dc.configContext)
      childGlyph.draw(ctx, childLayout, dc)
    }
  },
}
