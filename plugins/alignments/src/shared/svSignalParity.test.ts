import { namesToBlock, svSignalTier } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { isEvidenceRead } from '../../../breakpoint-split-view/src/BreakpointSplitView/readChains.ts'
import { filterChainFeatures } from '../RenderAlignmentDataRPC/filterChainFeatures.ts'
import { buildBaseFeatureData } from './buildBaseFeatureData.ts'
import { buildBaseReadArrays } from './buildBaseReadArrays.ts'
import { extractFeatureArrays } from './extractFeatureArrays.ts'

// The read filter, the `svSignal` sort and the breakpoint split view each ask
// "is this read SV evidence?", the filter of the feature in the worker and the
// other two of the extract's `readCategoryBits`. Each record here is a chain of
// its own, so the filter's chain-wide judgement is the record's.
const PAIRED = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
const PROPER = PAIRED | SAM_FLAG_PROPER_PAIR

const CASES = [
  {
    name: 'split primary, SA tag only',
    flags: PROPER,
    orientation: 'F1R2',
    CIGAR: '40S60M',
    SA: 'chr4,5000,+,60S40M,60,0;',
    tier: 3,
  },
  {
    name: 'supplementary (0x800)',
    flags: PROPER | SAM_FLAG_SUPPLEMENTARY,
    orientation: 'F1R2',
    CIGAR: '60M40H',
    tier: 3,
  },
  {
    name: '60 bp deletion in a concordant pair',
    flags: PROPER,
    orientation: 'F1R2',
    CIGAR: '50M60D50M',
    tier: 2,
  },
  {
    name: '60 bp insertion in a concordant pair',
    flags: PROPER,
    orientation: 'F1R2',
    CIGAR: '50M60I50M',
    tier: 2,
  },
  {
    name: 'mate unmapped',
    flags: PAIRED | SAM_FLAG_MATE_UNMAPPED,
    CIGAR: '100M',
    tier: 1,
  },
  {
    name: 'mate on another chromosome',
    flags: PAIRED,
    CIGAR: '100M',
    tier: 1,
  },
  {
    name: 'RF orientation, flagged proper',
    flags: PROPER,
    orientation: 'R1F2',
    CIGAR: '100M',
    tier: 1,
  },
  {
    name: 'concordant pair',
    flags: PROPER,
    orientation: 'F1R2',
    CIGAR: '50M49D50M',
    tier: 0,
  },
  {
    name: 'unpaired long read',
    flags: 0,
    CIGAR: '2000M30I3000M',
    tier: 0,
  },
  {
    name: 'unpaired long read with an SV-size deletion',
    flags: 0,
    CIGAR: '2000M300D3000M',
    tier: 2,
  },
]

const features = CASES.map(
  (c, i) =>
    new SimpleFeature({
      uniqueId: `r${i}`,
      refName: 'chr1',
      start: 100 + i,
      end: 200 + i,
      name: c.name,
      flags: c.flags,
      pair_orientation: c.orientation,
      CIGAR: c.CIGAR,
      tags: c.SA ? { SA: c.SA } : {},
    }),
)

const extraction = extractFeatureArrays(
  features,
  f => buildBaseFeatureData(f, undefined),
  {
    showSoftClipping: false,
    region: { assemblyName: 'hg', refName: 'chr1', start: 0, end: 10_000 },
    perBaseBinBp: 1,
  },
)
const { readArrays } = buildBaseReadArrays(extraction.features, undefined)
const overlay = {
  ...readArrays,
  ...namesToBlock(CASES.map(c => c.name)),
  readInterchrom: new Uint8Array(CASES.length),
  readSuppAlignments: extraction.suppAlignments,
  readCategoryBits: extraction.categoryBits,
}

describe.each(CASES.map((c, i) => ({ ...c, i })))('$name', ({ i, tier }) => {
  const kept = filterChainFeatures(
    [features[i]!],
    [{ field: 'svSignal', equal: true }],
  )

  test('the filter, the sort and the split view agree', () => {
    expect({
      filter: kept.length === 1,
      sort: svSignalTier(extraction.categoryBits[i]!) > 0,
      splitView: isEvidenceRead(overlay, i),
    }).toEqual({ filter: tier > 0, sort: tier > 0, splitView: tier > 0 })
  })

  test('the sort lifts it to its tier', () => {
    expect(svSignalTier(extraction.categoryBits[i]!)).toBe(tier)
  })
})
