import { SimpleFeature } from '@jbrowse/core/util'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { buildBaseFeatureData } from '../../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../../shared/buildBaseReadArrays.ts'
import { extractFeatureArrays } from '../../shared/extractFeatureArrays.ts'
import { buildReadNameBlock } from '../../shared/readNameBlock.ts'
import { computeReadChains } from '../arcs/arcChains.ts'
import { computeDerivativePaths } from './computePaths.ts'

import type { MismatchFeature } from '../../shared/extractCigarFeatures.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// A de novo assembly contig aligned to the reference reaches this pipeline as
// an `LGVSyntenyDisplay`'s PAF blocks, and it is a split read at a larger
// scale: one name, one block per reference interval, an offset along the
// contig on each. This class states the contract `SyntenyFeature` meets
// (`plugins/comparative-adapters/src/SyntenyFeature/contigChain.test.ts` pins
// its side): `forEachMismatch` is what puts a feature on the
// `clipLengthAtStartOfRead`-property branch of the extractor, and the name and
// the offset both come from the block's other side. No SA tag, so a contig's
// chain is only what the displayed regions fetched.
class ContigBlock extends SimpleFeature implements MismatchFeature {
  forEachMismatch() {}

  get clipLengthAtStartOfRead(): number {
    return (this.get('mate') as { start: number }).start
  }
}

function contigBlock({
  contig,
  refName,
  start,
  end,
  strand,
  contigStart,
}: {
  contig: string
  refName: string
  start: number
  end: number
  strand: number
  contigStart: number
}) {
  return new ContigBlock({
    uniqueId: `${contig}-${refName}-${start}`,
    name: contig,
    refName,
    start,
    end,
    strand,
    CIGAR: `${end - start}M`,
    mate: {
      refName: contig,
      start: contigStart,
      end: contigStart + end - start,
    },
  })
}

const REGIONS = [
  { refName: 'chr3', start: 0, end: 100_000, displayedRegionIndex: 0 },
  { refName: 'chr13', start: 0, end: 100_000, displayedRegionIndex: 1 },
]

function fetchResult(features: Feature[], region: Region) {
  const extracted = extractFeatureArrays(
    features,
    (f: Feature) => buildBaseFeatureData(f, undefined),
    { colorBy: undefined, showSoftClipping: false, region, perBaseBinBp: 1 },
  )
  const { readArrays } = buildBaseReadArrays(extracted.features, undefined)
  return makePileupDataResult({
    ...readArrays,
    ...buildReadNameBlock(features),
    readClipAtStart: new Uint32Array(extracted.clipAtStart),
  })
}

// Two haplotype contigs of one junction: chr13 forward into chr3 inverted, the
// HG008-T `chr3_chr13_hap1` shape. Each contig's chr13 block comes first on
// the contig, so the chr3 block carries the larger offset.
function lanes(contigs: string[], chr3Blocks = true) {
  const chr13 = contigs.map(contig =>
    contigBlock({
      contig,
      refName: 'chr13',
      start: 40_000,
      end: 60_000,
      strand: 1,
      contigStart: 0,
    }),
  )
  const chr3 = chr3Blocks
    ? contigs.map(contig =>
        contigBlock({
          contig,
          refName: 'chr3',
          start: 10_000,
          end: 30_000,
          strand: -1,
          contigStart: 20_000,
        }),
      )
    : []
  return [
    new Map([
      [
        0,
        fetchResult(chr3, {
          refName: 'chr3',
          start: 0,
          end: 100_000,
          assemblyName: 'hg38',
        }),
      ],
      [
        1,
        fetchResult(chr13, {
          refName: 'chr13',
          start: 0,
          end: 100_000,
          assemblyName: 'hg38',
        }),
      ],
    ]),
  ]
}

test('two contigs over two displayed regions are one route, in contig order', () => {
  const chains = computeReadChains(lanes(['hap1', 'hap2']), REGIONS)
  expect(chains).toHaveLength(2)
  // contig order, not fetch order: chr13 carries offset 0, chr3 offset 20 kb,
  // and the chr3 region was extracted first
  expect(chains[0]!.map(s => [s.refName, s.strand, s.clipAtStart])).toEqual([
    ['chr13', 1, 0],
    ['chr3', -1, 20_000],
  ])
  const candidates = computeDerivativePaths({ chains, minReads: 1 })
  expect(candidates).toHaveLength(1)
  expect(candidates[0]!.readCount).toBe(2)
  // presented from the lower of the two ends the allele could begin at, which
  // `orientForDisplay` compares by refName first — lexicographic, so chr13 leads
  expect(
    candidates[0]!.observedSegments.map(s => [s.refName, s.strand]),
  ).toEqual([
    ['chr13', 1],
    ['chr3', -1],
  ])
  // every block was fetched: nothing here names a segment off screen
  expect(candidates[0]!.extendsOffScreen).toBe(false)
})

test('a lone contig still makes a route at the assembly floor of one', () => {
  const chains = computeReadChains(lanes(['hap1']), REGIONS)
  expect(computeDerivativePaths({ chains })).toEqual([])
  expect(computeDerivativePaths({ chains, minReads: 1 })).toHaveLength(1)
})

test('a contig with one block on screen describes no route', () => {
  const chains = computeReadChains(lanes(['hap1', 'hap2'], false), REGIONS)
  expect(chains).toEqual([])
  expect(computeDerivativePaths({ chains, minReads: 1 })).toEqual([])
})
