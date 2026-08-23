import createJexlInstance from '@jbrowse/core/util/jexl'

import { buildFeatureRenderData } from './buildFeatureRenderData.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { Feature } from '@jbrowse/core/util'

// What the isoform cap buys on the wire, which is the argument that carried it
// into the worker (ADR-075: "a 40-transcript Gencode gene ships one
// transcript's geometry, not forty") and had never been measured. The record is
// `agent-docs/measurements/isoform-cap-payload.json`; PRINT_ISOFORM_PAYLOAD=1
// re-prints the table to refresh it. Named `.measure.test.ts` like
// `pifTierBytes.measure.test.ts`: a test that both guards a claim and takes the
// number behind it.
//
// Byte COUNTS, deliberately, not timings — exact and deterministic, so jest is
// a valid harness for them. It is not one for the time the same pipeline takes
// (BENCHMARKING.md measures jest inflating typed-array work 6-30x), and no
// timing is claimed here for that reason.
const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const { type, name, start, end, subfeatures = [] } = opts
  return {
    get: (key: string) =>
      ({ type, name, start, end, strand: 1, subfeatures })[key],
    id: () => `${type}-${name}-${start}`,
    parent: () => undefined,
  } as unknown as Feature
}

// Exons, not just a span: the rect count a transcript contributes is what the
// payload is made of, so a one-box transcript would understate the whole thing.
function transcript(gene: string, i: number, start: number, exons: number) {
  return mockFeature({
    type: 'mRNA',
    name: `${gene}-t${i}`,
    start,
    end: start + exons * 900,
    subfeatures: Array.from({ length: exons }, (_, e) =>
      mockFeature({
        type: 'CDS',
        name: `${gene}-t${i}-cds${e}`,
        start: start + e * 900,
        end: start + e * 900 + 400,
      }),
    ),
  })
}

function gene(name: string, start: number, isoforms: number, exons: number) {
  return mockFeature({
    type: 'gene',
    name,
    start,
    end: start + exons * 900,
    subfeatures: Array.from({ length: isoforms }, (_, i) =>
      transcript(name, i, start + i, exons),
    ),
  })
}

// Shaped like a real annotation rather than uniformly: most genes have one
// transcript and a long tail has many, which is what decides how much a cap can
// ever remove. 50 genes is already generous for the zoom the cap runs at — it
// needs `effectiveGeneGlyphMode === 'all'`, i.e. <= 100 bp/px, and the fetch is
// a buffered viewport slice, so far fewer genes are usually in play.
const ISOFORM_COUNTS = [
  ...Array.from({ length: 30 }, () => 1),
  ...Array.from({ length: 12 }, () => 3),
  ...Array.from({ length: 5 }, () => 8),
  ...Array.from({ length: 2 }, () => 20),
  40,
]

function buildRegion(maxIsoforms: number | undefined) {
  const features = ISOFORM_COUNTS.map((n, i) =>
    gene(`G${i}`, 1000 + i * 40_000, n, 8),
  )
  return buildFeatureRenderData({
    features,
    featureCount: features.length,
    config: mockDisplayConfig({
      geneGlyphMode: 'all',
      maxIsoforms,
      geneOwnRows: maxIsoforms === undefined ? undefined : 25 / 12,
      transcriptTypes: ['mRNA'],
    }),
    jexl,
    regionStart: 0,
    regionEnd: 2_100_000,
  })
}

// Typed arrays cross as transferables (zero-copy); everything else is
// structured-cloned, which is where the strings are. Summed together as the
// payload, but the split is why the saving matters even less than the total
// suggests — half of what a cap removes was never copied.
function payloadBytes(maxIsoforms: number | undefined) {
  let bytes = 0
  const cloned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(
    buildRegion(maxIsoforms) as unknown as Record<string, unknown>,
  )) {
    if (ArrayBuffer.isView(value)) {
      bytes += value.byteLength
    } else {
      cloned[key] = value
    }
  }
  return (
    bytes +
    JSON.stringify(cloned, (_k, v: unknown) => (v instanceof Map ? [...v] : v))
      .length
  )
}

// A ~200px lane holds 14 isoform rows, a ~400px one holds 31 (isoformRowBudget
// at the default 10px feature height).
const LANES = [
  { label: '~400px lane', cap: 31 },
  { label: '~200px lane', cap: 14 },
  { label: '~100px lane', cap: 6 },
  { label: '~20px lane', cap: 1 },
]

test('the isoform cap saves a minority of the payload at usable track heights', () => {
  const uncapped = payloadBytes(undefined)
  const savedAt = (cap: number) => (uncapped - payloadBytes(cap)) / uncapped

  // The claim ADR-075 now rests on. Generous bounds — the point is the order of
  // magnitude, not the digits, and an emitter change is allowed to move those.
  expect(savedAt(31)).toBeLessThan(0.1)
  expect(savedAt(14)).toBeLessThan(0.25)

  // ...and the cap is not useless either: a lane that holds one still sheds
  // most of it, which is the case it was built for.
  expect(savedAt(1)).toBeGreaterThan(0.5)

  if (process.env.PRINT_ISOFORM_PAYLOAD) {
    // the run's whole output — the rows pasted into
    // measurements/isoform-cap-payload.json, in KB
    // eslint-disable-next-line no-console
    console.log(
      [
        `uncapped     ${uncapped} bytes`,
        ...LANES.map(({ label, cap }) => {
          const total = payloadBytes(cap)
          return `${label.padEnd(12)} cap=${String(cap).padEnd(3)} ${total} bytes, saved ${uncapped - total} (${((1 - total / uncapped) * 100).toFixed(1)}%)`
        }),
      ].join('\n'),
    )
  }
})
