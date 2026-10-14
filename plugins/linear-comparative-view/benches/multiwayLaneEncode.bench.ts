/* eslint-disable no-console */
// What would multi-way lane genes cost through the shared encoder, against the
// hand packer that draws them now? ADR-180's stage 2 waits on this number.
//
//   pnpm exec esbuild --bundle --platform=node --format=esm --target=node22 \
//     --outfile=/tmp/laneencode.mjs \
//     plugins/linear-comparative-view/benches/multiwayLaneEncode.bench.ts
//   node /tmp/laneencode.mjs --lanes=40 --genes=60 --rounds=15
//
// Bundled, since `LaneGene`'s parameter property is past node's type stripping.
//
// Forty mate lanes, each a frame over its own contig holding `genes` genes of
// two mRNA isoforms with eight CDS segments each, then arms interleaved and
// rotated round-robin, min across rounds (agent-docs/reference/BENCHMARKING.md):
//
//   geometry       geneGlyphGeometry per gene: the shape cut at the lane's
//                  holes and placed through its frame, the projection a
//                  coordinate stage would take over
//   pack           buildLaneCells per lane, which a settle runs on every lane
//   pack-control   the same calls through a second driver, the harness's floor
//   encode         the same rects, intron lines and arrows in lane bp through
//                  `flatten` and `encodeFeatures`, three families per lane
//
// `encode` is a floor, as ADR-114's was: it fills x, x2, y, color and one
// integer lane per family, and leaves the strand row, the UTR height, the arrow
// width, the hit list and the cluster claims a gene takes from the placements
// unwritten. `pack` is the whole hand path, frame projection included, with
// each gene's shape already cached as `LaneGene` holds it across settles.
import { performance } from 'node:perf_hooks'

import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import {
  LaneGene,
  geneGlyphGeometry,
} from '../src/MultiWaySyntenyDisplay/geneGlyph.ts'
import {
  buildLanes,
  laneGeometry,
} from '../src/MultiWaySyntenyDisplay/laneStack.ts'
import { groupFeatures } from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'
import { buildLaneCells } from '../src/MultiWaySyntenyDisplay/multiwayGeometry.ts'

import type { RowFrame } from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 15)
const laneCount = arg('lanes', 40)
const genesPerLane = arg('genes', 60)

const EXONS = 8
const ISOFORMS = 2
const GENE_BP = 20_000
const WIDTH = 1600
const HEIGHT = 2000
const SPAN_BP = genesPerLane * GENE_BP

const lanes = Array.from({ length: laneCount }, (_, i) => `lane${i}`)

function makeGene(lane: string, i: number) {
  const geneStart = i * GENE_BP
  const strand = i % 2 === 0 ? 1 : -1
  return new SimpleFeature({
    uniqueId: `${lane}-gene${i}`,
    refName: 'ctg',
    start: geneStart,
    end: geneStart + GENE_BP,
    type: 'gene',
    strand,
    name: `GENE${i}`,
    subfeatures: Array.from({ length: ISOFORMS }, (_, t) => ({
      uniqueId: `${lane}-gene${i}.${t}`,
      refName: 'ctg',
      start: geneStart,
      end: geneStart + GENE_BP,
      type: 'mRNA',
      strand,
      subfeatures: Array.from({ length: EXONS }, (_, e) => {
        const start = geneStart + e * 2000 + t * 100
        return {
          uniqueId: `${lane}-gene${i}.${t}.cds${e}`,
          refName: 'ctg',
          start,
          end: start + 900,
          type: 'CDS',
        }
      }),
    })),
  })
}

const laneGenes = new Map(
  lanes.map(lane => [
    lane,
    Array.from(
      { length: genesPerLane },
      (_, i) => new LaneGene(makeGene(lane, i)),
    ),
  ]),
)

// one alignment record per lane, so every lane is framed over its genes
const groups = groupFeatures(
  lanes.map(
    (lane, i) =>
      new SimpleFeature({
        uniqueId: `record${i}`,
        refName: 'chr1',
        start: 0,
        end: SPAN_BP,
        strand: 1,
        mate: { assemblyName: lane, refName: 'ctg', start: 0, end: SPAN_BP },
      }),
  ),
)
const frame: RowFrame = {
  refName: 'ctg',
  min: 0,
  max: SPAN_BP,
  flipped: false,
  fitMin: 0,
  fitMax: SPAN_BP,
  alsoOn: [],
  alsoOnMore: 0,
  alsoAt: [],
}
const stack = buildLanes({
  assemblyNames: ['anchor', ...lanes],
  groups,
  anchorSpans: new Map(groups.map(g => [g.key, [0, WIDTH] as const])),
  rowFrames: new Map(lanes.map(lane => [lane, frame])),
  axisSpanOf: () => undefined,
  anchorRegionSpans: [[0, WIDTH]],
  anchorBpPerPx: SPAN_BP / WIDTH,
  contigOf: () => undefined,
  refNameAliasOf: () => undefined,
  width: WIDTH,
  geometry: laneGeometry(HEIGHT, 1 + laneCount),
})
const mateLanes = stack.lanes.slice(1)

const painted = { css: 'goldenrod', packed: 0xff20a5da }
const colors = {
  genes: { fill: () => painted, utr: () => painted.packed },
  boxes: { fill: () => painted, utr: () => painted.packed },
  stroke: 'black',
  divider: 'grey',
}

function geometryAll() {
  let n = 0
  for (const lane of mateLanes) {
    for (const gene of laneGenes.get(lane.assemblyName)!) {
      const { feature } = gene
      const span = lane.spanOf('ctg', feature.get('start'), feature.get('end'))
      if (span) {
        n += geneGlyphGeometry(gene, span, (start, end) =>
          lane.spansOf('ctg', start, end),
        ).full.length
      }
    }
  }
  return n
}

function packAll() {
  let n = 0
  for (const lane of mateLanes) {
    n += buildLaneCells({
      lane,
      genes: laneGenes.get(lane.assemblyName)!,
      glyphHeight: stack.glyphHeight,
      width: WIDTH,
      colors,
    }).glyphs.rectYs.length
  }
  return n
}

function packAllControl() {
  let n = 0
  for (const lane of mateLanes) {
    n += buildLaneCells({
      lane,
      genes: laneGenes.get(lane.assemblyName)!,
      glyphHeight: stack.glyphHeight,
      width: WIDTH,
      colors,
    }).glyphs.rectYs.length
  }
  return n
}

// What the lane would hand the encoder: its genes' rects, intron lines and
// arrows in lane bp, one container per family, built once outside the timing
// as the pack arms' genes are.
function familiesOf(genes: readonly LaneGene[]) {
  const rects: object[] = []
  const lines: object[] = []
  const arrows: object[] = []
  genes.forEach((gene, i) => {
    const { feature } = gene
    const start: number = feature.get('start')
    const end: number = feature.get('end')
    const { full, thin } = gene.shape
    for (const [s, e] of [...full, ...thin]) {
      rects.push({ start: s, end: e, y: 0, color: painted.packed, index: i })
    }
    const covered = [...full, ...thin].sort((a, b) => a[0] - b[0])
    let at = start
    for (const [s, e] of covered) {
      if (s > at) {
        lines.push({ start: at, end: s, y: 0, color: 0, index: i })
      }
      at = Math.max(at, e)
    }
    const tip = feature.get('strand') === 1 ? end : start
    arrows.push({ start: tip, end: tip, y: 0, color: 0, index: i })
  })
  return [rects, lines, arrows].map(
    items =>
      new SimpleFeature({
        uniqueId: 'family',
        refName: 'ctg',
        start: 0,
        end: SPAN_BP,
        items,
      }),
  )
}

const laneFamilies = mateLanes.map(lane =>
  familiesOf(laneGenes.get(lane.assemblyName)!),
)
const FLATTEN = [{ type: 'flatten' as const, field: 'items' }]
const LANES = ['y', 'color', 'row'] as const

function encodeAll() {
  let n = 0
  for (const families of laneFamilies) {
    for (const container of families) {
      n += encodeFeatures(
        runTransforms([container], FLATTEN),
        { x: 'start', x2: 'end', y: 'y', color: 'color', row: 'index' },
        LANES,
      ).count
    }
  }
  return n
}

// Separate function literals on purpose: a shared driver takes every arm's
// call site polymorphic and prices the harness rather than the code.
const drivers = [
  { name: 'geometry', run: () => geometryAll() },
  { name: 'pack', run: () => packAll() },
  { name: 'pack-control', run: () => packAllControl() },
  { name: 'encode', run: () => encodeAll() },
]

const primitives = laneFamilies.reduce(
  (sum, families) =>
    sum +
    families.reduce(
      (n, family) => n + (family.get('items') as object[]).length,
      0,
    ),
  0,
)
console.log(
  `${laneCount} lanes, ${genesPerLane} genes each, ${ISOFORMS} isoforms of ${EXONS} CDS: ${primitives.toLocaleString()} primitives`,
)
for (const { name, run } of drivers) {
  console.log(`${name.padEnd(13)} ${run()}`)
}

const best = drivers.map(() => Infinity)
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < drivers.length; k++) {
    const i = (k + r) % drivers.length
    const t0 = performance.now()
    drivers[i]!.run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
  }
}

const pack = best[1]!
console.log(`\nrounds=${rounds}, min per arm`)
for (const [i, { name }] of drivers.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(13)} ${ms.toFixed(2).padStart(8)}ms  ` +
      `${((ms / primitives) * 1e6).toFixed(0).padStart(6)}ns/primitive  ` +
      `${(ms / pack).toFixed(2)}x pack`,
  )
}
