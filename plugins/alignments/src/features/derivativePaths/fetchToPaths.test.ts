import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { buildBaseFeatureData } from '../../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../../shared/buildBaseReadArrays.ts'
import { extractFeatureArrays } from '../../shared/extractFeatureArrays.ts'
import { buildReadNameBlock } from '../../shared/readNameBlock.ts'
import { computeReadChains } from '../arcs/arcChains.ts'
import { computeDerivativePaths } from './computePaths.ts'

import type { Feature, Region } from '@jbrowse/core/util'

// THE SEAM THIS FILE EXISTS FOR: everything else under `derivativePaths/` hands
// `computeReadChains` / `computeDerivativePaths` a `SegAln[]` built by hand, so
// the whole question of whether a FETCH produces the SA tags those chains are
// made of goes untested — and that is exactly where the bug was.
//
// `extractFeatureArrays` was briefly gated to skip the per-read SA tag walk
// while read connections were off, on the belief that the arc band was the only
// consumer. It is not; this pipeline is the second, and it is ungated by design.
// So on the default fetch the dialog silently lost every segment known only from
// an SA tag — which in a single-region view is a translocation's entire far side
// — and all six existing suites stayed green, because each one supplies the SA
// segments the extraction had stopped producing.
//
// Hence: real extraction, real chain builder, real ranking, one assertion about
// a segment no region covers. The only hand-written part is the field assembly
// `executeRenderAlignmentData` does between them.

const region: Region = {
  refName: 'chr1',
  start: 0,
  end: 10_000,
  assemblyName: 'test',
}
const regions = [
  { refName: 'chr1', start: 0, end: 10_000, displayedRegionIndex: 0 },
]

// A split read: 100 aligned bases on chr1, the other 50 hard-clipped away to
// chr7, which no displayed region covers. Only the SA tag knows about chr7.
function splitRead(name: string, start: number) {
  return new SimpleFeature({
    uniqueId: name,
    // The QNAME, not decoration: `groupReadsByName` skips a nameless feature
    // (a PAF block has none), so a fixture without one chains nothing at all.
    name,
    refName: 'chr1',
    start,
    end: start + 100,
    strand: 1,
    CIGAR: '100M50S',
    flags: 0,
    tags: { SA: 'chr7,5000,+,100S50M,60,0;' },
  })
}

// What `executeRenderAlignmentData` assembles between the extractor and the
// main thread, narrowed to the fields the chain builder reads.
function fetchResult(features: Feature[]) {
  const extracted = extractFeatureArrays(
    features,
    (f: Feature) => buildBaseFeatureData(f, undefined),
    { colorBy: undefined, showSoftClipping: false, region },
  )
  const { readArrays } = buildBaseReadArrays(extracted.features, undefined)
  return makePileupDataResult({
    ...readArrays,
    ...buildReadNameBlock(features),
    readSuppAlignments: extracted.suppAlignments,
    readClipAtStart: new Uint32Array(extracted.clipAtStart),
  })
}

test('a fetch carries the SA tags the chain builder needs', () => {
  const data = fetchResult([splitRead('r1', 1000), splitRead('r2', 1003)])
  // The extraction is where the regression was: no SA here and every assertion
  // below passes vacuously with chains of length 1, which is why this one is
  // stated separately.
  expect(data.readSuppAlignments).toBeDefined()

  const chains = computeReadChains([new Map([[0, data]])], regions)
  expect(chains).toHaveLength(2)
  // Two segments: the fetched chr1 one, and the chr7 one no region covers.
  expect(chains[0]!.map(s => s.refName)).toEqual(['chr1', 'chr7'])
  expect(chains[0]![1]!.onScreen).toBe(false)
})

// A read that traverses a circular amplicon twice: two alignments at ONE locus,
// distinguishable only by where each pass sits in the read (ecDNA / double
// minute reads look exactly like this). The segment dedup that collapses a
// fetched record with its SA-tag twin therefore keys on the read position too —
// keyed on the locus alone it folded the two passes into one segment, deleting
// the circle-closing junction while still counting the read as support for a
// linear allele it does not describe, and dropping this read's chain outright.
function circlePassRead(name: string, pass: number) {
  const firstPass = pass === 0
  return new SimpleFeature({
    uniqueId: `${name}/${pass}`,
    name,
    refName: 'chr1',
    start: 1000,
    end: 1100,
    strand: 1,
    CIGAR: firstPass ? '100M100S' : '100S100M',
    flags: firstPass ? 0 : 2048,
    tags: {
      SA: firstPass
        ? 'chr1,1001,+,100S100M,60,0;'
        : 'chr1,1001,+,100M100S,60,0;',
    },
  })
}

test('a read circling one locus keeps both passes and the junction between them', () => {
  const data = fetchResult([
    circlePassRead('r1', 0),
    circlePassRead('r1', 1),
    circlePassRead('r2', 0),
    circlePassRead('r2', 1),
  ])
  const chains = computeReadChains([new Map([[0, data]])], regions)
  expect(chains).toHaveLength(2)
  // Two passes at one locus, separated only by where each sits in the read —
  // while each fetched record still collapses with the SA twin its sibling
  // carries, or this chain would be four segments rather than two.
  expect(
    chains[0]!.map(s => `${s.refName}:${s.start}:${s.clipAtStart}`),
  ).toEqual(['chr1:1000:0', 'chr1:1000:100'])

  const candidates = computeDerivativePaths({ chains })
  expect(candidates).toHaveLength(1)
  expect(candidates[0]!.readCount).toBe(2)
  expect(candidates[0]!.segments).toHaveLength(2)
})

test('the two reads rank as one off-screen derivative path', () => {
  const data = fetchResult([splitRead('r1', 1000), splitRead('r2', 1003)])
  const candidates = computeDerivativePaths({
    chains: computeReadChains([new Map([[0, data]])], regions),
  })
  expect(candidates).toHaveLength(1)
  expect(candidates[0]!.readCount).toBe(2)
  expect(candidates[0]!.refNames).toEqual(['chr1', 'chr7'])
  // The half a single-region view cannot see for itself, and the half the
  // skipped tag walk removed.
  expect(candidates[0]!.extendsOffScreen).toBe(true)
})

// The same read, its two segments in two DISPLAY LANES, which is what "group by
// strand" does to every read crossing an inversion — the segments are on
// opposite strands by definition. The lanes are chained together rather than one
// at a time because each lane can rebuild the whole chain on its own: it has one
// segment as a fetched entry and reaches the rest through that segment's SA tag.
// Chained per lane and concatenated, the two identical chains grouped and the
// route claimed twice the support that exists, which is the only number the
// picker ranks by and the only one it shows.
function inversionRead(name: string, start: number) {
  const [left, right] = [start, start + 55_000]
  return [
    new SimpleFeature({
      uniqueId: `${name}-p`,
      name,
      refName: 'chr1',
      start: left,
      end: left + 5000,
      strand: 1,
      CIGAR: '5000M4000S',
      flags: 0,
      tags: { SA: `chr1,${right + 1},-,4000M5000S,60,0;` },
    }),
    new SimpleFeature({
      uniqueId: `${name}-s`,
      name,
      refName: 'chr1',
      start: right,
      end: right + 4000,
      strand: -1,
      CIGAR: '4000M5000S',
      flags: 2048,
      tags: { SA: `chr1,${left + 1},+,5000M4000S,60,0;` },
    }),
  ]
}

test('a read split across two lanes is still one read', () => {
  const reads = [...inversionRead('r1', 5000), ...inversionRead('r2', 5003)]
  const ungrouped = computeDerivativePaths({
    chains: computeReadChains(
      [fetchResult(reads)].map(d => new Map([[0, d]])),
      [{ refName: 'chr1', start: 0, end: 200_000, displayedRegionIndex: 0 }],
    ),
  })
  const byStrand = computeDerivativePaths({
    chains: computeReadChains(
      [
        fetchResult(reads.filter(f => f.get('strand') === 1)),
        fetchResult(reads.filter(f => f.get('strand') === -1)),
      ].map(d => new Map([[0, d]])),
      [{ refName: 'chr1', start: 0, end: 200_000, displayedRegionIndex: 0 }],
    ),
  })
  expect(ungrouped).toHaveLength(1)
  expect(ungrouped[0]!.readCount).toBe(2)
  expect(byStrand.map(c => c.readCount)).toEqual([2])
  // and the partner segment is a drawn read rather than an SA record, so the row
  // stops saying the path leaves a window both of its ends are in
  expect(byStrand[0]!.extendsOffScreen).toBe(false)
})

// A paired-end fragment whose read1 is split (chr1 primary, chr7 supplementary)
// and whose read2 maps plainly nearby. The two mates share a QNAME, so the
// grouping puts them in one bucket and `resolveReadGroup` has to partition
// them by pair role before chaining: chained together, read2 would be joined
// onto read1's chain as a third segment through a junction no molecule has.
function pairedSplitFragment(name: string, start: number) {
  return [
    new SimpleFeature({
      uniqueId: `${name}/1`,
      name,
      refName: 'chr1',
      start,
      end: start + 100,
      strand: 1,
      CIGAR: '100M50S',
      flags: SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
      tags: { SA: 'chr7,5000,+,100S50M,60,0;' },
    }),
    new SimpleFeature({
      uniqueId: `${name}/2`,
      name,
      refName: 'chr1',
      start: start + 200,
      end: start + 300,
      strand: -1,
      CIGAR: '100M',
      flags: SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      tags: {},
    }),
  ]
}

test('a paired read chains each mate on its own', () => {
  const data = fetchResult([
    ...pairedSplitFragment('f1', 1000),
    ...pairedSplitFragment('f2', 1003),
  ])
  const chains = computeReadChains([new Map([[0, data]])], regions)
  expect(chains).toHaveLength(2)
  for (const chain of chains) {
    expect(chain.map(s => s.refName)).toEqual(['chr1', 'chr7'])
  }
  const candidates = computeDerivativePaths({ chains })
  expect(candidates).toHaveLength(1)
  expect(candidates[0]!.readCount).toBe(2)
})
