import { applyLabelDimensions } from '../labelUtils'
import { readCachedConfig } from '../renderConfig'
import { boxGlyph } from './box'
import { processedTranscriptGlyph } from './processed'
import { segmentsGlyph } from './segments'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
import type { Feature } from '@jbrowse/core/util'

const TRANSCRIPT_PADDING = 2
const CODING_TYPES = new Set(['CDS', 'cds'])

function hasCodingSubfeature(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures') || []
  return subfeatures.some(
    (sub: Feature) =>
      CODING_TYPES.has(sub.get('type')) || hasCodingSubfeature(sub),
  )
}

function getChildGlyph(
  child: Feature,
  configContext: LayoutArgs['configContext'],
): Glyph {
  const { transcriptTypes } = configContext
  const childType = child.get('type')
  const subfeatures = child.get('subfeatures') as Feature[] | undefined

  if (!subfeatures?.length) {
    return boxGlyph
  }

  // Check if it's a coding transcript
  if (transcriptTypes.includes(childType)) {
    const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
    if (hasCDS) {
      return processedTranscriptGlyph
    }
  }

  return segmentsGlyph
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
      const childGlyph = getChildGlyph(child, configContext)

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
      // No children - draw as a box
      boxGlyph.draw(ctx, { ...layout, glyphType: 'Box' }, dc)
      return
    }

    // Draw each child transcript
    // Children have positions relative to parent, each child glyph will handle its own children
    const leftPx = layout.x
    const topPx = layout.y

    for (const childLayout of children) {
      // Convert transcript from relative to absolute coordinates
      // The child glyph (processed/segments) will handle its own exon children
      const childAbsolute = {
        ...childLayout,
        x: leftPx + childLayout.x,
        y: topPx + childLayout.y,
      }

      // Dispatch to appropriate glyph
      switch (childLayout.glyphType) {
        case 'ProcessedTranscript':
          processedTranscriptGlyph.draw(ctx, childAbsolute, dc)
          break
        case 'Segments':
          segmentsGlyph.draw(ctx, childAbsolute, dc)
          break
        default:
          boxGlyph.draw(ctx, childAbsolute, dc)
          break
      }
    }
  },
}
