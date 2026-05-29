import { applyLabelDimensions } from '../labelUtils.ts'
import { findGlyph } from './findGlyph.ts'
import { getFeatureHeightPx, hasCodingSubfeature } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const TRANSCRIPT_PADDING = 2

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
  const { feature, config } = args
  const { geneGlyphMode, transcriptTypes, subfeatureLabels } = config

  const heightPx = getFeatureHeightPx(config)

  let subfeatures = [...(feature.get('subfeatures') ?? [])]
  if (geneGlyphMode === 'longest' || geneGlyphMode === 'longestCoding') {
    subfeatures = filterByGeneGlyphMode(
      subfeatures,
      transcriptTypes,
      geneGlyphMode,
    )
  } else {
    // Sort coding transcripts first so they render on top in stacked layout.
    // Skipped for longest/longestCoding which collapse to a single feature.
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
  }

  const transcriptTypeSet = new Set(transcriptTypes)
  const children: FeatureLayout[] = []
  let currentYPx = 0

  for (const [i, child] of subfeatures.entries()) {
    const childType = child.get('type') ?? ''
    const isChildTranscript = transcriptTypeSet.has(childType)
    const childLayout = findGlyph(
      child,
      config,
      false,
    )({
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
    y: 0,
    height: totalHeightPx,
    totalLayoutHeight: totalHeightPx,
    children,
  }
}
