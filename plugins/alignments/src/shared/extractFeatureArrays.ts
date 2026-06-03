import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { extractCigarFeatures } from './extractCigarFeatures.ts'
import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import {
  extractMethylation,
  extractModifications,
} from '../features/modification/extract.ts'
import { extractPerBaseQuality } from '../features/perBaseQuality/extract.ts'

import type { ColorBy } from './types.ts'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { PerBaseQualityEntry } from '../features/perBaseQuality/types.ts'
import type { Mismatch } from '@jbrowse/alignments-core'
import type { Feature, Region } from '@jbrowse/core/util'
import type { ModificationType } from '@jbrowse/modifications-utils'

interface ExtractOpts {
  colorBy: ColorBy | undefined
  showSoftClipping: boolean
  region: Region
  sortTag?: string
}

export function extractFeatureArrays<T extends FeatureData>(
  featuresArray: Feature[],
  buildFeatureData: (feature: Feature) => T,
  opts: ExtractOpts,
) {
  const { colorBy, showSoftClipping, region, sortTag } = opts
  const detectedModifications = new Set<string>()
  // Unique (strand, type) pairs across all reads → global simplex resolution.
  const seenModTypes = new Map<string, ModificationType>()

  const features: T[] = []
  const cigarOutput = {
    gaps: [] as GapData[],
    mismatches: [] as MismatchData[],
    insertions: [] as InsertionData[],
    softclips: [] as SoftclipData[],
    hardclips: [] as HardclipData[],
  }
  const modifications: ModificationEntry[] = []
  const perBaseQualities: PerBaseQualityEntry[] = []
  const isPerBaseQualityMode = colorBy?.type === 'perBaseQuality'
  const tagColorValues: string[] = []
  const nextPositions: number[] = []
  const nextRefs: string[] = []
  const suppAlignments: string[] = []
  const isTagColorMode = colorBy?.type === 'tag' && !!colorBy.tag
  const sortTagValues: string[] | undefined = sortTag ? [] : undefined

  for (const feature of featuresArray) {
    const featureId = feature.id()
    const featureStart = feature.get('start')
    const strand = feature.get('strand')!

    features.push(buildFeatureData(feature))

    nextPositions.push((feature.get('next_pos') as number | undefined) ?? 0)
    nextRefs.push((feature.get('next_ref') as string | undefined) ?? '')
    const tags = feature.get('tags') as Record<string, unknown> | undefined
    suppAlignments.push(
      ((tags?.SA ?? feature.get('SA')) as string | undefined) ?? '',
    )

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
      extractCigarFeatures(
        featureMismatches,
        featureId,
        featureStart,
        strand,
        feature,
        cigarOutput,
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
      seenModTypes,
      modifications,
    )

    if (colorBy?.type === 'methylation' && modData) {
      extractMethylation(
        featureId,
        featureStart,
        strand,
        region,
        modData,
        modifications,
        colorBy.modifications?.cytosineContext ?? 'CG',
      )
    }

    if (isPerBaseQualityMode) {
      extractPerBaseQuality(feature, featureId, region, perBaseQualities)
    }
  }

  modifications.sort((a, b) => a.modType.localeCompare(b.modType))

  // Resolve simplex globally now that every read is parsed (one answer per type,
  // not a per-read guess). See detectSimplexModifications.
  const detectedSimplexModifications = detectSimplexModifications([
    ...seenModTypes.values(),
  ])

  const uniqueTagValues = isTagColorMode
    ? [...new Set(tagColorValues)].filter(v => v !== '')
    : undefined

  return {
    features,
    ...cigarOutput,
    modifications,
    perBaseQualities,
    tagColorValues,
    uniqueTagValues,
    sortTagValues,
    nextPositions,
    nextRefs,
    suppAlignments,
    detectedModifications,
    detectedSimplexModifications,
  }
}
