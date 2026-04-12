import { applyLabelDimensions } from '../labelUtils.ts'
import { findGlyph } from './findGlyph.ts'
import { getFeatureDimensions } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const TRANSCRIPT_PADDING = 2
const CODING_TYPES = new Set(['CDS', 'cds'])

function hasCodingSubfeature(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures') || []
  return subfeatures.some(
    (sub: Feature) =>
      CODING_TYPES.has(sub.get('type') ?? '') || hasCodingSubfeature(sub),
  )
}

function filterByGeneGlyphMode(
  subfeatures: Feature[],
  transcriptTypes: string[],
  mode: 'longest' | 'longestCoding',
): Feature[] {
  if (subfeatures.length <= 1) {
    return subfeatures
  }

  const transcriptSubfeatures = subfeatures.filter(sub =>
    transcriptTypes.includes(sub.get('type') ?? ''),
  )
  let candidates =
    transcriptSubfeatures.length > 0 ? transcriptSubfeatures : subfeatures

  if (mode === 'longestCoding') {
    const codingCandidates = candidates.filter(hasCodingSubfeature)
    if (codingCandidates.length > 0) {
      candidates = codingCandidates
    }
  }

  const longest = candidates.reduce((a, b) =>
    a.get('end') - a.get('start') > b.get('end') - b.get('start') ? a : b,
  )
  return [longest]
}

export function layoutSubfeatures(args: LayoutArgs): FeatureLayout {
  const { feature, bpPerPx, config } = args
    const { geneGlyphMode, transcriptTypes, subfeatureLabels } = config

    const {
      start: featureStart,
      heightPx,
      widthPx,
    } = getFeatureDimensions(feature, bpPerPx, config)

    // Sort coding transcripts first so they render on top in stacked layout
    let subfeatures = [...(feature.get('subfeatures') || [])]
    const codingStatus = new Map(
      subfeatures.map(f => [f.id(), hasCodingSubfeature(f)]),
    )
    subfeatures.sort((a, b) => {
      const aHasCDS = codingStatus.get(a.id())
      const bHasCDS = codingStatus.get(b.id())
      if (aHasCDS && !bHasCDS) {
        return -1
      }
      if (!aHasCDS && bHasCDS) {
        return 1
      }
      return 0
    })

    if (geneGlyphMode === 'longest' || geneGlyphMode === 'longestCoding') {
      subfeatures = filterByGeneGlyphMode(
        subfeatures,
        transcriptTypes,
        geneGlyphMode,
      )
    }

    const children: FeatureLayout[] = []
    let currentYPx = 0

    for (const [i, child] of subfeatures.entries()) {
      const childType = child.get('type') ?? ''
      const isChildTranscript = transcriptTypes.includes(childType)
      const childLayout = findGlyph(child, config, false)({
        ...args,
        feature: child,
        parentFeature: feature,
      })

      applyLabelDimensions(childLayout, {
        feature: child,
        config,
        isNested: true,
        isTranscriptChild: isChildTranscript,
      })

      const xRelativePx = (child.get('start') - featureStart) / bpPerPx

      childLayout.x = xRelativePx
      childLayout.y = currentYPx

      children.push(childLayout)

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

    const totalHeightPx = currentYPx > 0 ? currentYPx : heightPx

    return {
      feature,
      glyphType: 'Subfeatures',
      x: 0,
      y: 0,
      width: widthPx,
      height: totalHeightPx,
      totalLayoutHeight: totalHeightPx,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children,
    }
}
