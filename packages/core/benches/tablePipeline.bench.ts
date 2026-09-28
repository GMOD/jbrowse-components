// The mark pipeline — steps, facet and encode — in the working tree against
// the same modules from another git ref, over the inputs large enough to take
// seconds: a million features through each step, and a MAF region through the
// cells declaration.
//
//   node --max-old-space-size=14000 packages/core/benches/tablePipeline.bench.ts
//   node ... tablePipeline.bench.ts --base=main --rounds=5 --features=1000000 --maf --json
//
// `--maf` adds the `marks_maf_cells` declaration over the synthetic MAF-tabix
// fixture at 470 species (plugins/maf/benches/mafTabixFixture.ts), which needs
// bgzip and tabix on PATH, twice: once over the blocks as features, and once
// with the head arm answering the table the MAF adapters do
// (`mafFeatureTableOf`), its pack inside the timing.
//
// Three arms per scenario, interleaved round-robin with the order rotated,
// MIN across rounds (agent-docs/reference/BENCHMARKING.md): `base` is the ref,
// `control` the ref extracted a second time into its own directory, `head`
// the working tree. Each arm's driver is its own function literal, so no call
// site is shared between arms. Before timing, every scenario's lanes are
// compared across the arms: count, x, x2, y, row and colour, as sorted tuples
// since a step may hand its rows on in another order.
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { checkoutPackageAtRef } from '../../../plugins/maf/benches/refCheckout.ts'
import createJexlInstance from '../src/util/jexl.ts'
import SimpleFeature from '../src/util/simpleFeature.ts'

import type { LaneName, TransformStep } from '../src/util/markEncoding.ts'
import type { Feature } from '../src/util/simpleFeature.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)
const baseRef = flag('base') ?? 'main'
const rounds = num('rounds', 5)
const n = num('features', 1_000_000)
const withMaf = process.argv.includes('--maf')

const root = join(import.meta.dirname, '..', '..', '..')
const jexl = createJexlInstance()

interface Encoded {
  count: number
  x: Uint32Array
  x2: Uint32Array
  y?: Float32Array
  row?: Uint32Array
  color?: Uint32Array
}
interface Pipeline {
  runTransforms: (
    features: unknown,
    steps: readonly TransformStep[],
    jexl: unknown,
  ) => unknown
  facetLayers: (
    features: unknown,
    facet: { field: string },
    layers: { transform?: TransformStep[] }[],
    jexl: unknown,
  ) => { layers: Record<string, unknown>[] }
  layerTables?: (
    features: unknown,
    request: {
      transform: TransformStep[]
      facet: { field: string } | undefined
      layers: Record<string, unknown>[]
    },
    jexl: unknown,
  ) => { layers: { table: unknown; row: unknown }[] }
  encodeFeatures: (
    features: unknown,
    encoding: Record<string, unknown>,
    lanes: readonly LaneName[],
    ctx: { jexl: unknown },
  ) => Encoded
}

async function load(dir: string): Promise<Pipeline> {
  const util = join(dir, 'packages/core/src/util')
  const transforms = await import(join(util, 'featureTransforms.ts'))
  const encoding = await import(join(util, 'markEncoding.ts'))
  return {
    runTransforms: transforms.runTransforms,
    facetLayers: transforms.facetLayers,
    layerTables: transforms.layerTables,
    encodeFeatures: encoding.encodeFeatures,
  }
}

interface Scenario {
  name: string
  input: readonly Feature[]
  steps: TransformStep[]
  facet?: string
  encoding: Record<string, unknown>
  lanes: LaneName[]
  /** The lanes the working tree's display asks for, where they differ from the ref's. */
  headLanes?: LaneName[]
  /** The table the working tree's adapter answers in place of `input`, made inside the timing. */
  headInput?: () => unknown
}

// The layer a faceted request encodes: its rows in section order under
// either spelling of the faceted layer, and their stacked rows.
function layerOf(layer: Record<string, unknown>) {
  return {
    rows: layer.table ?? layer.features,
    stacked: layer.rows as ArrayLike<number>,
  }
}

// One driver per arm, written out rather than shared, so no call site goes
// polymorphic across arms.
function baseDriver(p: Pipeline, s: Scenario) {
  return () => {
    const shared = p.runTransforms(s.input, s.steps, jexl)
    if (s.facet) {
      const { layers } = p.facetLayers(shared, { field: s.facet }, [{}], jexl)
      const { rows, stacked } = layerOf(layers[0]!)
      return p.encodeFeatures(rows, { ...s.encoding, row: stacked }, s.lanes, {
        jexl,
      })
    }
    return p.encodeFeatures(shared, s.encoding, s.lanes, { jexl })
  }
}
function controlDriver(p: Pipeline, s: Scenario) {
  return () => {
    const shared = p.runTransforms(s.input, s.steps, jexl)
    if (s.facet) {
      const { layers } = p.facetLayers(shared, { field: s.facet }, [{}], jexl)
      const { rows, stacked } = layerOf(layers[0]!)
      return p.encodeFeatures(rows, { ...s.encoding, row: stacked }, s.lanes, {
        jexl,
      })
    }
    return p.encodeFeatures(shared, s.encoding, s.lanes, { jexl })
  }
}
// The working tree runs a request as `layerFeatures` does, through
// `layerTables`, which splits a faceted request as early as its steps allow.
function headDriver(p: Pipeline, s: Scenario) {
  const plan = p.layerTables!
  return () => {
    const input = s.headInput ? s.headInput() : s.input
    const { layers } = plan(
      input,
      {
        transform: s.steps,
        facet: s.facet ? { field: s.facet } : undefined,
        layers: [{ row: s.encoding.row }],
      },
      jexl,
    )
    const { table, row } = layers[0]!
    return p.encodeFeatures(
      table,
      { ...s.encoding, row },
      s.headLanes ?? s.lanes,
      {
        jexl,
      },
    )
  }
}

function tuples(e: Encoded) {
  return Array.from({ length: e.count }, (_, i) =>
    [e.x[i], e.x2[i], e.y?.[i], e.row?.[i], e.color?.[i]].join(':'),
  ).sort()
}

function sameLanes(name: string, a: Encoded, b: Encoded) {
  if (a.count !== b.count) {
    throw new Error(`${name}: ${a.count} instances against ${b.count}`)
  }
  const ta = tuples(a)
  const tb = tuples(b)
  const at = ta.findIndex((t, i) => t !== tb[i])
  if (at >= 0) {
    throw new Error(`${name}: first difference ${ta[at]} against ${tb[at]}`)
  }
}

function syntheticFeatures() {
  return Array.from({ length: n }, (_, i) => {
    const start = i * 3
    return new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'chr1',
      start,
      end: start + 2 + (i % 5),
      score: (i * 7919) % 1000,
      strand: i % 3 === 0 ? -1 : 1,
      sample: `s${i % 26}`,
    })
  })
}

// Containers of four over the SAME feature objects, so the fan-out answers
// exactly the million the flat scenarios read.
function nestedFeatures(features: readonly Feature[]) {
  return Array.from({ length: features.length / 4 }, (_, i) => {
    const members = features.slice(i * 4, i * 4 + 4)
    return {
      get: (name: string) =>
        name === 'subfeatures' ? members : members[0]!.get(name),
      id: () => `group${i}`,
      toJSON: () => ({ uniqueId: `group${i}` }),
    } as unknown as Feature
  })
}

async function mafFeatures() {
  const { DEFAULT_SPEC, ensureMafTabixFixture } =
    await import('../../../plugins/maf/benches/mafTabixFixture.ts')
  const spec = { ...DEFAULT_SPEC, blocks: 200, species: 470 }
  const fixture = ensureMafTabixFixture(undefined, spec)
  const { readFileSync } = await import('node:fs')
  const { gunzipSync } = await import('node:zlib')
  // The adapter's parse is not what this measures, so the blocks are built
  // straight from the fixture's lines as MafFeature holds them.
  const text = gunzipSync(readFileSync(fixture.bedGzPath)).toString()
  return text
    .trim()
    .split('\n')
    .map((line, b) => {
      const [refName, start, end, , , packed] = line.split('\t')
      const alignments: Record<string, Record<string, unknown>> = {}
      let refSeq = ''
      for (const entry of packed!.split(',')) {
        const [src, srcStart, , strand, srcSize, seq] = entry.split(':')
        const species = src!.split('.')[0]!
        alignments[species] = {
          chr: src!.split('.')[1],
          srcStart: Number(srcStart),
          strand: strand === '-' ? -1 : 1,
          srcSize: Number(srcSize),
          seq,
        }
        if (species === 'sp0') {
          refSeq = seq!
        }
      }
      return new SimpleFeature({
        uniqueId: `block${b}`,
        refName: refName!,
        start: Number(start),
        end: Number(end),
        seq: refSeq,
        alignments,
      })
    })
}

// Built the first time a selected scenario reads them, so a run of the MAF
// scenarios alone keeps no million features alive: every full collection
// marks the whole heap, and a typed arm's buffers trigger them.
let synthetic: { flat: Feature[]; nested: Feature[] } | undefined
function syntheticInputs() {
  if (!synthetic) {
    const flat = syntheticFeatures()
    synthetic = { flat, nested: nestedFeatures(flat) }
  }
  return synthetic
}
const BIN: TransformStep[] = [
  { type: 'bin', step: 10_000 },
  { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
]
const BAR: LaneName[] = ['y', 'color']
// A span asked main's worker for the hit index; since the row lookup it asks
// for none, and the display finds a hovered span by its row.
const SPAN: LaneName[] = ['row', 'color', 'index']
const SPAN_BY_ROW: LaneName[] = ['row', 'color']

const scenarios: Scenario[] = [
  {
    name: 'encode, y and a colour',
    get input() {
      return syntheticInputs().flat
    },
    steps: [],
    encoding: { y: 'score', color: 'red' },
    lanes: [...BAR, 'index'],
  },
  {
    name: 'encode, categorical colour',
    get input() {
      return syntheticInputs().flat
    },
    steps: [],
    encoding: { y: 'score', color: { field: 'strand', scale: 'categorical' } },
    lanes: BAR,
  },
  {
    name: 'encode, jexl y',
    get input() {
      return syntheticInputs().flat
    },
    steps: [],
    encoding: { y: 'jexl:feature.score * 2', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'filter',
    get input() {
      return syntheticInputs().flat
    },
    steps: [{ type: 'filter', expr: 'jexl:feature.score % 2 == 0' }],
    encoding: { y: 'score', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'formula',
    get input() {
      return syntheticInputs().flat
    },
    steps: [{ type: 'formula', expr: 'jexl:feature.score * 2', as: 'twice' }],
    encoding: { y: 'twice', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'flatten',
    get input() {
      return syntheticInputs().nested
    },
    steps: [{ type: 'flatten' }],
    encoding: { y: 'score', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'bin, count',
    get input() {
      return syntheticInputs().flat
    },
    steps: BIN,
    encoding: { y: 'count', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'bin, mean',
    get input() {
      return syntheticInputs().flat
    },
    steps: [
      BIN[0]!,
      {
        type: 'aggregate',
        groupby: ['start', 'end'],
        ops: [{ op: 'count' }, { op: 'mean', field: 'score' }],
      },
    ],
    encoding: { y: 'mean_score', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'coverage',
    get input() {
      return syntheticInputs().flat
    },
    steps: [{ type: 'coverage' }],
    encoding: { y: 'coverage', color: 'red' },
    lanes: BAR,
  },
  {
    name: 'pileup',
    get input() {
      return syntheticInputs().flat
    },
    steps: [{ type: 'pileup' }],
    encoding: { y: 'score', row: 'row', color: 'red' },
    lanes: [...BAR, 'row'],
  },
  {
    name: 'rows by sample',
    get input() {
      return syntheticInputs().flat
    },
    steps: [],
    facet: 'sample',
    encoding: { color: 'red' },
    lanes: SPAN,
    headLanes: SPAN_BY_ROW,
  },
]

if (withMaf) {
  const blocks = await mafFeatures()
  const { mafFeatureTableOf } =
    await import('../../../plugins/maf/src/util/mafFeatureTable.ts')
  const cells = {
    input: blocks,
    steps: [
      { type: 'flatten', field: 'alignments', key: 'species' },
      { type: 'cells' },
    ] satisfies TransformStep[],
    facet: 'species',
    encoding: {
      color: {
        field: 'state',
        scale: 'categorical',
        domain: ['match', 'mismatch', 'gap', 'insertion'],
        range: ['#d9d9d9', '#e41a1c', '#404040', '#984ea3'],
      },
    },
    lanes: SPAN,
    headLanes: SPAN_BY_ROW,
  }
  scenarios.push(
    { name: 'MAF cells, 470 species', ...cells },
    {
      name: 'MAF cells typed, 470 species',
      ...cells,
      headInput: () => mafFeatureTableOf(blocks, blocks[0]!.get('refName')),
    },
  )
}

const only = flag('only')?.split(',')
if (only) {
  scenarios.splice(
    0,
    scenarios.length,
    ...scenarios.filter(s => only.some(o => s.name.includes(o))),
  )
}

const baseDir = checkoutPackageAtRef(root, baseRef, 'packages/core')
const controlDir = checkoutPackageAtRef(root, baseRef, 'packages/core')
try {
  const base = await load(baseDir)
  const control = await load(controlDir)
  const head = await load(root)
  const arms = scenarios.map(s => ({
    base: baseDriver(base, s),
    control: controlDriver(control, s),
    head: headDriver(head, s),
  }))
  for (const [i, s] of scenarios.entries()) {
    const { base: b, head: h } = arms[i]!
    sameLanes(s.name, b(), h())
  }
  const best = arms.map(() => ({
    base: Infinity,
    control: Infinity,
    head: Infinity,
  }))
  const order = ['base', 'control', 'head'] as const
  for (let r = 0; r < rounds; r++) {
    for (const [i, arm] of arms.entries()) {
      for (let k = 0; k < 3; k++) {
        const which = order[(r + k) % 3]!
        const t0 = performance.now()
        arm[which]()
        best[i]![which] = Math.min(best[i]![which], performance.now() - t0)
      }
    }
  }
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        scenarios.map((s, i) => ({
          scenario: s.name,
          baseMs: Math.round(best[i]!.base * 10) / 10,
          controlMs: Math.round(best[i]!.control * 10) / 10,
          headMs: Math.round(best[i]!.head * 10) / 10,
        })),
        null,
        2,
      ),
    )
  }
  console.log(
    `\nbase ${baseRef} against the working tree, ${n.toLocaleString()} features, min of ${rounds}`,
  )
  console.table(
    scenarios.map((s, i) => {
      const { base: b, control: c, head: h } = best[i]!
      return {
        scenario: s.name,
        base: `${b.toFixed(0)}ms`,
        control: `${c.toFixed(0)}ms`,
        head: `${h.toFixed(0)}ms`,
        'control/base': (c / b).toFixed(2),
        'head/base': (h / b).toFixed(2),
      }
    }),
  )
} finally {
  rmSync(baseDir, { recursive: true, force: true })
  rmSync(controlDir, { recursive: true, force: true })
}
