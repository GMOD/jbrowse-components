import {
  buildTagColors,
  extractFeatureTagValue,
  extractMismatchData,
} from './processFeatureAlignments.ts'
import {
  extractMethylation,
  extractModifications,
} from '../features/modification/extract.ts'

import type { ColorBy, Mismatch } from './types.ts'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

interface ExtractOpts {
  colorBy: ColorBy | undefined
  colorTagMap: Record<string, string> | undefined
  showSoftClipping: boolean
  region: { start: number; end: number }
  regionStart: number
  sortTag?: string
}

export function extractFeatureArrays<T extends FeatureData>(
  featuresArray: Feature[],
  buildFeatureData: (feature: Feature) => T,
  opts: ExtractOpts,
) {
  const {
    colorBy,
    colorTagMap,
    showSoftClipping,
    region,
    regionStart,
    sortTag,
  } = opts
  const detectedModifications = new Set<string>()
  const detectedSimplexModifications = new Set<string>()

  const features: T[] = []
  const gaps: GapData[] = []
  const mismatches: MismatchData[] = []
  const insertions: InsertionData[] = []
  const softclips: SoftclipData[] = []
  const hardclips: HardclipData[] = []
  const modifications: ModificationEntry[] = []
  const tagColorValues: string[] = []
  const nextPositions: number[] = []
  const nextRefs: string[] = []
  const suppAlignments: string[] = []
  const isTagColorMode = colorBy?.type === 'tag' && colorBy.tag && colorTagMap
  const sortTagValues: string[] | undefined = sortTag ? [] : undefined

  for (const feature of featuresArray) {
    const featureId = feature.id()
    const featureStart = feature.get('start')
    const strand = feature.get('strand')!

    features.push(buildFeatureData(feature))

    nextPositions.push(feature.get('next_pos') ?? 0)
    nextRefs.push(feature.get('next_ref') ?? '')
    suppAlignments.push(feature.get('tags')?.SA ?? feature.get('SA') ?? '')

    if (isTagColorMode) {
      tagColorValues.push(extractFeatureTagValue(feature, colorBy.tag!))
    }

    if (sortTagValues && sortTag) {
      sortTagValues.push(extractFeatureTagValue(feature, sortTag))
    }

    const featureMismatches = feature.get('mismatches') as
      | Mismatch[]
      | undefined
    if (featureMismatches) {
      extractMismatchData(
        featureMismatches,
        featureId,
        featureStart,
        strand,
        feature,
        gaps,
        mismatches,
        insertions,
        softclips,
        hardclips,
        showSoftClipping,
      )
    }

    const modData = extractModifications(
      feature,
      featureId,
      featureStart,
      strand,
      colorBy,
      detectedModifications,
      detectedSimplexModifications,
      modifications,
    )

    if (colorBy?.type === 'methylation' && modData) {
      extractMethylation(
        featureId,
        featureStart,
        strand,
        regionStart,
        Math.ceil(region.end),
        modData,
        modifications,
      )
    }
  }

  const tagColors = isTagColorMode
    ? buildTagColors(features, tagColorValues, colorBy, colorTagMap)
    : new Uint32Array(0)

  modifications.sort((a, b) => a.modType.localeCompare(b.modType))

  const uniqueTagValues = isTagColorMode
    ? [...new Set(tagColorValues)].filter(v => v !== '')
    : undefined

  return {
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    tagColors,
    uniqueTagValues,
    sortTagValues,
    nextPositions,
    nextRefs,
    suppAlignments,
    detectedModifications,
    detectedSimplexModifications,
  }
}
