import { getClip } from '@jbrowse/cigar-utils'
import { getTag } from '@jbrowse/modifications-utils'

import {
  extractBisulfite,
  extractMethylation,
  extractModifications,
} from '../features/modification/extract.ts'
import { extractPerBaseLetter } from '../features/perBaseLetter/extract.ts'
import { extractPerBaseQuality } from '../features/perBaseQuality/extract.ts'
import {
  extractCigarFeatures,
  extractCigarFeaturesFromString,
  isMismatchFeature,
} from './extractCigarFeatures.ts'
import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import { isFillUnmarkedMode } from './types.ts'
import { getStrand } from './util.ts'

import type { PerBaseLetterEntry } from '../features/perBaseLetter/types.ts'
import type { PerBaseQualityEntry } from '../features/perBaseQuality/types.ts'
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
import type { Feature, ProgressReporter, Region } from '@jbrowse/core/util'
import type { ModificationType } from '@jbrowse/modifications-utils'

// The name of whatever this feature aligns *to*. A synteny/PAF block carries a
// `mate` describing its position in the other assembly; a BAM read names its
// mate's reference in next_ref. Returns undefined when the feature has neither,
// so the caller can leave it uncolored rather than paint a hash of ''.
function getMateRefName(feature: Feature) {
  const mate = feature.get('mate') as { refName?: string } | undefined
  return mate?.refName ?? (feature.get('next_ref') as string | undefined)
}

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
  // ALWAYS walked, and shipped only when some read actually had one.
  //
  // The walk is not free — `getTag(feature, 'SA')` scans the read's whole tag
  // block, 18.1ms over 153,677 reads on the deepest short-read fixture — and it
  // was briefly gated on `readConnections !== 'off'` on the grounds that the arc
  // computation is the only consumer. It is not: `computeReadChains` feeds
  // `derivativePathCandidates` too, and that getter is deliberately ungated
  // ("a user who wants a reconstruction should not first have to turn on a
  // display option that draws something else"). With the gate on, the default
  // fetch carried no SA, so every off-screen split segment vanished from the
  // "Reconstruct derivative allele" dialog — which is most of them, since a
  // translocation's far segment is by definition not in a single-region view.
  //
  // What the gate was really buying was the CLONE, and `hasSuppAlignment` keeps
  // that half: structured clone is priced by object count, and on that fixture
  // the array is empty on every one of the 153,677 reads, so it now ships as
  // one `undefined` rather than as 153,677 empty strings. `readSuppAlignments`
  // is already an optional field every reader guards, so nothing downstream
  // learns a new shape.
  const suppAlignments: string[] = []
  let hasSuppAlignment = false
  // Soft/hard-clip length at the 5' start of the read in read coordinates
  // (getClip already accounts for strand). This is the read-order sort key that
  // lets the main thread chain split segments in true read order rather than
  // genomic order. Synteny features have no CIGAR and contribute 0.
  const clipAtStart: number[] = []
  const isTagColorMode = colorBy?.type === 'tag' && !!colorBy.tag
  // Chromosome painting reuses the tag channel: both resolve one string per
  // read that the main thread bakes into a color (see buildReadTagColors), so
  // the mate refName travels as a `tagColorValues` entry rather than earning a
  // parallel array. Only synteny features carry a mate, hence the ?? ''.
  const isMateRefNameMode = colorBy?.type === 'mateRefName'
  const sortTagValues: string[] | undefined = sortTag ? [] : undefined

  // readIndex is the feature's position here; it equals its index in the
  // returned `features` array and the per-read TypedArrays (buildBaseReadArrays),
  // so every primitive carries that integer instead of the string feature id.
  for (let readIndex = 0; readIndex < featuresArray.length; readIndex++) {
    report?.()
    const feature = featuresArray[readIndex]!
    const featureStart = feature.get('start')
    // Resolved once, through the one accessor, and handed to every extractor
    // below — so no per-feature pass can re-derive strand from a SAM flag.
    const strand = getStrand(feature)

    features.push(buildFeatureData(feature))

    nextPositions.push((feature.get('next_pos') as number | undefined) ?? 0)
    const sa = (getTag(feature, 'SA') as string | undefined) ?? ''
    hasSuppAlignment ||= sa !== ''
    suppAlignments.push(sa)
    const isMismatch = isMismatchFeature(feature)
    // Read once: it drives both the start clip and the indel walk below.
    const cigarString = isMismatch
      ? ''
      : ((feature.get('CIGAR') as string | undefined) ?? '')
    // clipAtStart: an alignment feature reads the start clip straight off its
    // packed CIGAR (`clipLengthAtStartOfRead`, required by MismatchFeature),
    // avoiding a full per-read CIGAR string build — and, for CRAM, its retention
    // in the feature LRU. Synteny features carry only a CIGAR string, so parse
    // that instead.
    clipAtStart.push(
      isMismatch
        ? feature.clipLengthAtStartOfRead
        : getClip(cigarString, strand),
    )

    if (isTagColorMode) {
      tagColorValues.push(extractFeatureTagValue(feature, colorBy.tag!))
    } else if (isMateRefNameMode) {
      tagColorValues.push(getMateRefName(feature) ?? '')
    }

    if (sortTagValues && sortTag) {
      sortTagValues.push(extractFeatureTagValue(feature, sortTag))
    }

    // Alignment features (BAM/CRAM) implement forEachMismatch; drive CIGAR
    // extraction off it directly rather than allocating a Mismatch[] per read.
    // A synteny feature (LGVSyntenyDisplay reuses this path) has no such method
    // but does carry a CIGAR string, so it walks that instead — an assembly
    // alignment's indels are the whole point of drawing it. A PIF's coarse tier
    // carries no CIGAR at all, and an empty string walks to nothing.
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
    } else if (cigarString) {
      extractCigarFeaturesFromString(
        feature,
        cigarString,
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

    if (isFillUnmarkedMode(colorBy) && modData) {
      extractMethylation(
        readIndex,
        featureStart,
        strand,
        region,
        modData,
        modifications,
        colorBy?.modifications?.cytosineContext ?? 'CG',
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
        colorBy.modifications?.twoColor ?? false,
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

  // modifications is intentionally left in read-arrival order: every downstream
  // consumer (buildModificationArrays' modType→index Map, buildModTooltipData's
  // position/modKey grouping, computeModificationCoverage's per-position sort)
  // groups by an explicit key, so array order is never observed. Sorting it —
  // localeCompare over a per-base nanopore array of 100k+ entries — was pure
  // overhead; don't reintroduce it.
  return {
    features,
    ...cigarOutput,
    modifications,
    perBaseQualities,
    perBaseLetters,
    tagColorValues,
    sortTagValues,
    nextPositions,
    // See its declaration: `undefined` when no read in this group carried an SA
    // tag, which is the deep short-read case and every synteny one.
    suppAlignments: hasSuppAlignment ? suppAlignments : undefined,
    clipAtStart,
    detectedModifications,
    // Raw (strand, type) pairs seen in this call. The worker merges these across
    // groups and resolves simplex globally so modification coloring is identical
    // in every section (see detectSimplexModifications in the worker entry).
    seenModTypes,
  }
}
