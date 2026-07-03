import { getClip } from '@jbrowse/cigar-utils'
import { getTag } from '@jbrowse/modifications-utils'

import {
  extractCigarFeatures,
  isMismatchFeature,
} from './extractCigarFeatures.ts'
import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import {
  extractBisulfite,
  extractMethylation,
  extractModifications,
} from '../features/modification/extract.ts'
import { extractPerBaseLetter } from '../features/perBaseLetter/extract.ts'
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
import type { PerBaseLetterEntry } from '../features/perBaseLetter/types.ts'
import type { PerBaseQualityEntry } from '../features/perBaseQuality/types.ts'
import type { Feature, ProgressReporter, Region } from '@jbrowse/core/util'
import type { ModificationType } from '@jbrowse/modifications-utils'

interface ExtractOpts {
  colorBy: ColorBy | undefined
  showSoftClipping: boolean
  region: Region
  sortTag?: string
  // reference for the bisulfite color mode (read-vs-reference C->T comparison)
  regionSequence?: string
  regionSequenceStart?: number
}

export function extractFeatureArrays<T extends FeatureData>(
  featuresArray: Feature[],
  buildFeatureData: (feature: Feature) => T,
  opts: ExtractOpts,
  report?: ProgressReporter,
) {
  const { colorBy, showSoftClipping, region, sortTag } = opts
  const { regionSequence, regionSequenceStart } = opts
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
  const perBaseLetters: PerBaseLetterEntry[] = []
  const isPerBaseLetterMode = colorBy?.type === 'perBaseLetter'
  const tagColorValues: string[] = []
  const nextPositions: number[] = []
  const nextRefs: string[] = []
  const suppAlignments: string[] = []
  // Soft/hard-clip length at the 5' start of the read in read coordinates
  // (getClip already accounts for strand). This is the read-order sort key that
  // lets the main thread chain split segments in true read order rather than
  // genomic order. Synteny features have no CIGAR and contribute 0.
  const clipAtStart: number[] = []
  const isTagColorMode = colorBy?.type === 'tag' && !!colorBy.tag
  const sortTagValues: string[] | undefined = sortTag ? [] : undefined

  // readIndex is the feature's position here; it equals its index in the
  // returned `features` array and the per-read TypedArrays (buildBaseReadArrays),
  // so every primitive carries that integer instead of the string feature id.
  for (let readIndex = 0; readIndex < featuresArray.length; readIndex++) {
    report?.()
    const feature = featuresArray[readIndex]!
    const featureStart = feature.get('start')
    const strand = feature.get('strand')!

    features.push(buildFeatureData(feature))

    nextPositions.push((feature.get('next_pos') as number | undefined) ?? 0)
    nextRefs.push((feature.get('next_ref') as string | undefined) ?? '')
    suppAlignments.push((getTag(feature, 'SA') as string | undefined) ?? '')
    const isMismatch = isMismatchFeature(feature)
    // clipAtStart: BAM/CRAM read the start clip straight off NUMERIC_CIGAR
    // (clipLengthAtStartOfRead), avoiding a full per-read CIGAR string build (and
    // for CRAM, its retention in the feature LRU). Synteny features carry only a
    // CIGAR string, so parse that instead.
    clipAtStart.push(
      isMismatch
        ? (feature.get('clipLengthAtStartOfRead') as number)
        : getClip((feature.get('CIGAR') as string | undefined) ?? '', strand),
    )

    if (isTagColorMode) {
      tagColorValues.push(extractFeatureTagValue(feature, colorBy.tag!))
    }

    if (sortTagValues && sortTag) {
      sortTagValues.push(extractFeatureTagValue(feature, sortTag))
    }

    // alignment features (BAM/CRAM) implement forEachMismatch; drive CIGAR
    // extraction off it directly rather than allocating a Mismatch[] per read.
    // Synteny features (LGVSyntenyDisplay reuses this path) have no such method,
    // so skip them — otherwise the call throws and fails the whole RPC.
    if (isMismatch) {
      // Clip CIGAR extraction to the visible region. For reads far larger than
      // the viewport (whole-chromosome assembly contigs) this skips walking the
      // off-screen bulk of the CIGAR entirely.
      extractCigarFeatures(
        feature,
        readIndex,
        featureStart,
        strand,
        cigarOutput,
        showSoftClipping,
        region.start,
        region.end,
      )
    }

    const modData = extractModifications(
      feature,
      readIndex,
      featureStart,
      strand,
      colorBy,
      detectedModifications,
      seenModTypes,
      modifications,
    )

    if (colorBy?.type === 'methylation' && modData) {
      extractMethylation(
        readIndex,
        featureStart,
        strand,
        region,
        modData,
        modifications,
        colorBy.modifications?.cytosineContext ?? 'CG',
      )
    }

    if (colorBy?.type === 'bisulfite' && regionSequence !== undefined) {
      extractBisulfite(
        feature,
        readIndex,
        featureStart,
        strand,
        region,
        regionSequence,
        regionSequenceStart ?? region.start,
        colorBy.modifications?.cytosineContext ?? 'CG',
        modifications,
      )
    }

    if (isPerBaseQualityMode) {
      extractPerBaseQuality(feature, readIndex, region, perBaseQualities)
    }

    if (isPerBaseLetterMode) {
      extractPerBaseLetter(feature, readIndex, region, perBaseLetters)
    }
  }

  modifications.sort((a, b) => a.modType.localeCompare(b.modType))

  const uniqueTagValues = isTagColorMode
    ? [...new Set(tagColorValues)].filter(v => v !== '')
    : undefined

  return {
    features,
    ...cigarOutput,
    modifications,
    perBaseQualities,
    perBaseLetters,
    tagColorValues,
    uniqueTagValues,
    sortTagValues,
    nextPositions,
    nextRefs,
    suppAlignments,
    clipAtStart,
    detectedModifications,
    // Raw (strand, type) pairs seen in this call. The worker merges these across
    // groups and resolves simplex globally so modification coloring is identical
    // in every section (see detectSimplexModifications in the worker entry).
    seenModTypes,
  }
}
