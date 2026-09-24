import { buildReadNameBlock } from '@jbrowse/alignments-core'
import { SimpleFeature } from '@jbrowse/core/util'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { buildBaseFeatureData } from '../../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../../shared/buildBaseReadArrays.ts'
import { extractFeatureArrays } from '../../shared/extractFeatureArrays.ts'
import { collectPendingArcs, groupLaneReadsByName } from './arcChains.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { MismatchFeature } from '../../shared/extractCigarFeatures.ts'
import type { RegionInfo } from './arcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'

// An assembly contig's PAF blocks, as `LGVSyntenyDisplay` feeds them to the
// arc path: one name, one block per reference interval, and the block's
// offset along the contig as its read-order key.
// `plugins/comparative-adapters/src/SyntenyFeature/contigChain.test.ts` pins
// the `SyntenyFeature` side of this contract.
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

// Two haplotype contigs of one junction, chr13 forward into chr3 inverted:
// each contig's chr13 block comes first on the contig.
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

test('a contig joins its blocks in contig order, not fetch order', () => {
  const arcs = splitArcs(lanes(['hap1', 'hap2']), REGIONS)
  expect(arcs.map(a => [a.p1Ref, a.p1Strand, a.p2Ref, a.p2Strand])).toEqual([
    ['chr13', 1, 'chr3', -1],
    ['chr13', 1, 'chr3', -1],
  ])
})

test('a contig with one block on screen makes no junction', () => {
  expect(splitArcs(lanes(['hap1', 'hap2'], false), REGIONS)).toEqual([])
})
