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
import { collectPendingArcs, groupLaneReadsByName } from './arcChains.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from './arcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// Real extraction feeding the real arc path: whether a fetch produces the SA
// tags a split junction is made of is the seam hand-built entries never test.

const region: Region = {
  refName: 'chr1',
  start: 0,
  end: 10_000,
  assemblyName: 'test',
}
const regions = [
  { refName: 'chr1', start: 0, end: 10_000, displayedRegionIndex: 0 },
]

function splitArcs(
  lanes: ReadonlyMap<number, WorkerPileupData>[],
  regions: RegionInfo[],
) {
  return collectPendingArcs(
    groupLaneReadsByName(
      lanes.map(lane => ['', lane] as const),
      regions,
    ),
    { drawLongRange: true, drawInter: true, canonicalRefName: r => r },
  ).filter(arc => arc.isSplit)
}

// 100 aligned bases on chr1; the other 50 are on chr7, which only the SA tag
// names.
function splitRead(name: string, start: number) {
  return new SimpleFeature({
    uniqueId: name,
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

function fetchResult(features: Feature[]) {
  const extracted = extractFeatureArrays(
    features,
    (f: Feature) => buildBaseFeatureData(f, undefined),
    { colorBy: undefined, showSoftClipping: false, region, perBaseBinBp: 1 },
  )
  const { readArrays } = buildBaseReadArrays(extracted.features, undefined)
  return makePileupDataResult({
    ...readArrays,
    ...buildReadNameBlock(features),
    readSuppAlignments: extracted.suppAlignments,
    readClipAtStart: new Uint32Array(extracted.clipAtStart),
  })
}

test('a fetch carries the SA tags a split junction needs', () => {
  const data = fetchResult([splitRead('r1', 1000), splitRead('r2', 1003)])
  expect(data.readSuppAlignments).toBeDefined()

  const arcs = splitArcs([new Map([[0, data]])], regions)
  expect(arcs.map(a => [a.p1Ref, a.p2Ref])).toEqual([
    ['chr1', 'chr7'],
    ['chr1', 'chr7'],
  ])
})

// Two passes of a circular amplicon at one locus, told apart only by where
// each sits in the read. Keyed on the locus alone, the dedup that folds a
// fetched record into its SA-tag twin collapsed them into one segment.
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

test('a read circling one locus keeps the junction between its passes', () => {
  const data = fetchResult([
    circlePassRead('r1', 0),
    circlePassRead('r1', 1),
    circlePassRead('r2', 0),
    circlePassRead('r2', 1),
  ])
  const arcs = splitArcs([new Map([[0, data]])], regions)
  expect(arcs.map(a => [a.p1Ref, a.p2Ref])).toEqual([
    ['chr1', 'chr1'],
    ['chr1', 'chr1'],
  ])
})

// Both mates share a QNAME, so they land in one bucket; chained together, read2
// would join read1's chain through a split junction no molecule has.
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
  const arcs = splitArcs([new Map([[0, data]])], regions)
  expect(arcs.map(a => [a.p1Ref, a.p2Ref])).toEqual([
    ['chr1', 'chr7'],
    ['chr1', 'chr7'],
  ])
})
