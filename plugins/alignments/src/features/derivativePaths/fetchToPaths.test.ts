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

  const chains = computeReadChains(new Map([[0, data]]), regions)
  expect(chains).toHaveLength(2)
  // Two segments: the fetched chr1 one, and the chr7 one no region covers.
  expect(chains[0]!.map(s => s.refName)).toEqual(['chr1', 'chr7'])
  expect(chains[0]![1]!.onScreen).toBe(false)
})

test('the two reads rank as one off-screen derivative path', () => {
  const data = fetchResult([splitRead('r1', 1000), splitRead('r2', 1003)])
  const candidates = computeDerivativePaths({
    chains: computeReadChains(new Map([[0, data]]), regions),
  })
  expect(candidates).toHaveLength(1)
  expect(candidates[0]!.readCount).toBe(2)
  expect(candidates[0]!.refNames).toEqual(['chr1', 'chr7'])
  // The half a single-region view cannot see for itself, and the half the
  // skipped tag walk removed.
  expect(candidates[0]!.extendsOffScreen).toBe(true)
})
