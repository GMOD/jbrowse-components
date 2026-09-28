import * as kernel from './cellMatches.ts'
import { valueAt } from './featureTable.ts'
import { layerTables, runTransforms } from './featureTransforms.ts'
import SimpleFeature from './simpleFeature.ts'

import type { FeatureTable } from './featureTable.ts'
import type {
  AggregateStep,
  BinStep,
  CellsStep,
  TransformStep,
} from './markEncodingTypes.ts'

function random(seed: number) {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const SPECIES = ['ref', 'a', 'b', 'c', 'd']

// Blocks of aligned text: reference gaps with bases inserted against them,
// row gaps inside and at either end, case, N, rows shorter than the
// reference, and blocks overlapping one another.
function blocks(
  count: number,
  seed: number,
  field = 'seq',
  { species = SPECIES, spacing = 0 } = {},
) {
  const next = random(seed)
  const pick = (s: string) => s[Math.floor(next() * s.length)]!
  return Array.from({ length: count }, (_, i) => {
    const columns = 1 + Math.floor(next() * 90)
    let ref = ''
    for (let c = 0; c < columns; c++) {
      ref += next() < 0.12 ? '-' : pick('ACGTNacgtn')
    }
    const alignments: Record<string, Record<string, string>> = {}
    for (const name of species) {
      if (next() < 0.15) {
        continue
      }
      const lead = next() < 0.3 ? Math.floor(next() * 12) : 0
      const trail = next() < 0.3 ? Math.floor(next() * 12) : 0
      const length = next() < 0.1 ? Math.floor(next() * columns) : columns
      let row = ''
      for (let c = 0; c < length; c++) {
        const roll = next()
        row +=
          c < lead || c >= columns - trail
            ? '-'
            : ref[c] === '-'
              ? roll < 0.5
                ? '-'
                : pick('ACGTacgt')
              : roll < 0.12
                ? '-'
                : roll < 0.6
                  ? next() < 0.3
                    ? ref[c]!.toLowerCase()
                    : ref[c]!
                  : pick('ACGTNacgtn')
      }
      alignments[name] = { [field]: row }
    }
    const start = spacing
      ? i * spacing
      : next() < 0.1
        ? 64 * Math.floor(next() * 20)
        : Math.floor(next() * 1500)
    return new SimpleFeature({
      uniqueId: `block${i}`,
      refName: next() < 0.5 ? 'ctgA' : 'ctgB',
      start,
      end: start + ref.replaceAll('-', '').length,
      [field]: ref,
      alignments,
    })
  })
}

const FLATTEN: TransformStep = {
  type: 'flatten',
  field: 'alignments',
  key: 'species',
}
const CELLS: CellsStep = { type: 'cells' }

function identity(step: number, groupby = ['start', 'end']) {
  const bin: BinStep = { type: 'bin', step, fields: ['start', 'end'] }
  const agg: AggregateStep = {
    type: 'aggregate',
    groupby,
    ops: [
      { op: 'mean', field: 'match', weight: 'overlap', as: 'identity' },
      { op: 'sum', field: 'match', weight: 'overlap', as: 'matched' },
    ],
  }
  return [bin, agg] as const
}

const FIELDS = ['refName', 'start', 'end', 'identity', 'matched', 'species']

function answers(table: FeatureTable) {
  return Array.from({ length: table.length }, (_, i) => {
    const row = table.row(i)
    return {
      id: row.id(),
      json: row.toJSON(),
      values: FIELDS.map(field => valueAt(table.column(field), i)),
    }
  })
}

// Bases matched over bases compared, per species and bin, off the text.
function oracle(input: SimpleFeature[], size: number) {
  const out = new Map<string, number>()
  const compared = new Map<string, number>()
  for (const f of input) {
    const ref = f.get('seq') as string
    const alignments = f.get('alignments') as Record<string, { seq: string }>
    for (const [species, { seq }] of Object.entries(alignments)) {
      let pos = f.get('start')
      for (let c = 0; c < ref.length; c++) {
        if (ref[c] === '-') {
          continue
        }
        const b = seq[c] ?? ' '
        if (b !== '-' && b !== ' ') {
          const key = `${species}:${Math.floor(pos / size) * size}`
          compared.set(key, (compared.get(key) ?? 0) + 1)
          out.set(
            key,
            (out.get(key) ?? 0) +
              (b.toUpperCase() === ref[c]!.toUpperCase() ? 1 : 0),
          )
        }
        pos++
      }
    }
  }
  return new Map([...out].map(([k, v]) => [k, v / compared.get(k)!]))
}

const SIZES = [1, 3, 10, 64]

afterEach(() => {
  jest.restoreAllMocks()
})

test('cells, an interval bin and a weighted mean of match fused answer what the three steps answer apart', () => {
  const walks = jest.spyOn(kernel, 'binnedCellMatches')
  for (const [seed, size] of SIZES.entries()) {
    const input = blocks(120, seed + 1)
    const [bin, agg] = identity(size)
    walks.mockClear()
    const fused = runTransforms(input, [FLATTEN, CELLS, bin, agg])
    expect(walks).toHaveBeenCalledTimes(1)
    expect(walks.mock.results[0]!.value).toBeDefined()
    const runs = runTransforms(input, [FLATTEN, CELLS])
    const apart = runTransforms(runTransforms(runs, [bin]), [agg])
    const binFused = runTransforms(runs, [bin, agg])
    expect(walks).toHaveBeenCalledTimes(1)
    expect(fused.length).toBeGreaterThan(20)
    expect(answers(fused)).toEqual(answers(apart))
    expect(answers(fused)).toEqual(answers(binFused))
  }
})

test('under a facet the fused walk runs in the layer and answers the unfused rows, per species', () => {
  const walks = jest.spyOn(kernel, 'binnedCellMatches')
  for (const [seed, size] of SIZES.entries()) {
    const input = blocks(150, seed + 20)
    const [bin, agg] = identity(size)
    walks.mockClear()
    const fused = layerTables(input, {
      transform: [FLATTEN, CELLS],
      facet: { field: 'species' },
      layers: [{ transform: [bin, agg] }, {}],
    })
    expect(walks).toHaveBeenCalledTimes(1)
    expect(walks.mock.results[0]!.value).toBeDefined()
    const apart = layerTables(input, {
      transform: [FLATTEN, CELLS],
      facet: { field: 'species', transform: [bin] },
      layers: [{ transform: [agg] }],
    })
    const runs = layerTables(input, {
      transform: [FLATTEN, CELLS],
      facet: { field: 'species' },
      layers: [{}],
    })
    expect(walks).toHaveBeenCalledTimes(1)
    expect(fused.sections).toEqual(apart.sections)
    const [f, cellsLayer] = fused.layers
    const [a] = apart.layers
    expect([...(f!.row as Uint32Array)]).toEqual([...(a!.row as Uint32Array)])
    expect(answers(f!.table)).toEqual(answers(a!.table))
    expect(answers(cellsLayer!.table)).toEqual(answers(runs.layers[0]!.table))

    const want = oracle(input, size)
    const species = new Map(fused.sections!.map(s => [s.firstRow, s.key]))
    const rows = f!.row as Uint32Array
    let valued = 0
    for (let i = 0; i < f!.table.length; i++) {
      const v = f!.table.row(i).get('identity')
      if (v !== undefined) {
        valued++
        const key = `${species.get(rows[i]!)}:${f!.table.row(i).get('start')}`
        expect(v).toBe(want.get(key))
      }
    }
    expect(valued).toBe(want.size)
  }
})

test('an unfaceted request hands its trailing cells to the layer that fuses it', () => {
  const input = blocks(60, 5)
  const [bin, agg] = identity(10)
  const walks = jest.spyOn(kernel, 'binnedCellMatches')
  const fused = layerTables(input, {
    transform: [FLATTEN, CELLS],
    layers: [{ transform: [bin, agg] }],
  })
  expect(walks).toHaveBeenCalledTimes(1)
  const apart = runTransforms(runTransforms(input, [FLATTEN, CELLS, bin]), [
    agg,
  ])
  expect(answers(fused.layers[0]!.table)).toEqual(answers(apart))
})

test('a cells step reading another field fuses over that field', () => {
  const input = blocks(60, 9, 'bases')
  const cells: CellsStep = { type: 'cells', field: 'bases' }
  const [bin, agg] = identity(7)
  const fused = runTransforms(input, [FLATTEN, cells, bin, agg])
  const apart = runTransforms(runTransforms(input, [FLATTEN, cells, bin]), [
    agg,
  ])
  expect(fused.length).toBeGreaterThan(20)
  expect(answers(fused)).toEqual(answers(apart))
})

test('the walk fuses only whole-base edges and the matches weighted by overlap', () => {
  const [bin, agg] = identity(10)
  const withOps = (ops: AggregateStep['ops']): AggregateStep => ({
    ...agg,
    ops,
  })
  expect(kernel.fusesCellMatches(CELLS, bin, agg)).toBe(true)
  expect(kernel.fusesCellMatches(CELLS, { ...bin, step: 2.5 }, agg)).toBe(false)
  expect(
    kernel.fusesCellMatches(CELLS, { ...bin, as: ['lo', 'hi'] }, agg),
  ).toBe(false)
  expect(
    kernel.fusesCellMatches(CELLS, bin, {
      ...agg,
      groupby: ['start', 'end', 'species'],
    }),
  ).toBe(false)
  for (const op of [
    { op: 'mean', field: 'match' },
    { op: 'mean', field: 'length', weight: 'overlap' },
    { op: 'count', weight: 'overlap' },
    { op: 'min', field: 'match', weight: 'overlap' },
  ] as const) {
    expect(kernel.fusesCellMatches(CELLS, bin, withOps([op]))).toBe(false)
  }
})

test('a start off the whole bases runs the steps as written', () => {
  const input = blocks(30, 13).map(
    f =>
      new SimpleFeature({
        ...f.toJSON(),
        start: f.get('start') + 0.5,
        end: f.get('end') + 0.5,
      }),
  )
  const [bin, agg] = identity(10)
  const walks = jest.spyOn(kernel, 'binnedCellMatches')
  const fused = runTransforms(input, [FLATTEN, CELLS, bin, agg])
  expect(walks.mock.results[0]!.value).toBeUndefined()
  const apart = runTransforms(runTransforms(input, [FLATTEN, CELLS, bin]), [
    agg,
  ])
  expect(answers(fused)).toEqual(answers(apart))
})

test('an insertion meets its bin ahead of the run still open across it', () => {
  const block = new SimpleFeature({
    uniqueId: 'b',
    refName: 'ctgA',
    start: 8,
    end: 14,
    seq: 'AA--AAAA',
    alignments: { x: { seq: 'AAGGAAAa' } },
  })
  const [bin, agg] = identity(2)
  const out = runTransforms([block], [FLATTEN, CELLS, bin, agg])
  expect(
    Array.from({ length: out.length }, (_, i) => [
      out.row(i).get('start'),
      out.row(i).get('identity'),
      out.row(i).id(),
    ]),
  ).toEqual([
    [10, 1, 'ctgA:10-12#0'],
    [8, 1, 'ctgA:8-10#1'],
    [12, 1, 'ctgA:12-14#2'],
  ])
})

test('many species over a wide region take the walk, one dense index reused per section', () => {
  const species = Array.from({ length: 120 }, (_, i) => `s${i}`)
  const input = blocks(60, 17, 'seq', { species, spacing: 1000 })
  const [bin, agg] = identity(10)
  const walks = jest.spyOn(kernel, 'binnedCellMatches')
  const fused = layerTables(input, {
    transform: [FLATTEN, CELLS],
    facet: { field: 'species' },
    layers: [{ transform: [bin, agg] }],
  })
  expect(walks.mock.results[0]!.value).toBeDefined()
  const apart = layerTables(input, {
    transform: [FLATTEN, CELLS],
    facet: { field: 'species', transform: [bin] },
    layers: [{ transform: [agg] }],
  })
  expect(answers(fused.layers[0]!.table)).toEqual(
    answers(apart.layers[0]!.table),
  )
})
