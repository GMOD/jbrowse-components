import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { types } from '@jbrowse/mobx-state-tree'

import RegionTooLargeMixin from './RegionTooLargeMixin.ts'
import { AUTO_FORCE_LOAD_BP } from './regionTooLargeUtils.ts'

import type { ByteEstimate } from './regionTooLargeUtils.ts'

// Exhaustive enumeration of the gate's composition. `regionTooLargeUtils.test`
// covers the comparison half and `RegionTooLargeMixin.test` covers named
// interactions; this covers the cross-product, so a corner nobody thought to
// name is still pinned.
//
// It is a cross-product of STATES and cannot see an order, which is the other
// half of the gate: which of two measurements wins, what a clear leaves behind,
// what an approval outlives. Those rules live in `nextGateState`, and
// `nextGateState.test.ts` walks event sequences over them — the two tests
// divide the gate between them exactly there.
//
// The leaves every derived getter sits on are the display opt-in and its
// density verdict, the two force-load flags, the viewport, the two limits, the
// stored estimate and the measured-viewport key. All eight are overridden here,
// so no view, track or config node is involved and a row costs one `create`.

const VIEWPORT_KEY = 'chr1:0-100'

const TruthTableDisplay = types
  .compose(
    'GateTruthTableDisplay',
    RegionTooLargeMixin(),
    types.model({
      inGateEnabled: types.boolean,
      inDensityTooLarge: types.boolean,
      inConfigForceLoad: types.boolean,
      inConfigLimit: types.number,
      inAdapterLimit: types.maybe(types.number),
      inSpanBp: types.maybe(types.number),
    }),
  )
  .views(self => ({
    get gateEnabled() {
      return self.inGateEnabled
    },
    get densityTooLarge() {
      return self.inDensityTooLarge
    },
    get configForceLoad() {
      return self.inConfigForceLoad
    },
    get configuredFetchSizeLimit() {
      return self.inConfigLimit
    },
    get adapterFetchSizeLimit() {
      return self.inAdapterLimit
    },
    get byteGateAdapterConfig() {
      return { type: 'StubAdapter' }
    },
    get gateViewport() {
      return self.inSpanBp === undefined
        ? undefined
        : { spanBp: self.inSpanBp, key: VIEWPORT_KEY }
    },
  }))
  .actions(self => ({
    setInputs(row: Row) {
      self.inGateEnabled = row.gateEnabled
      self.inDensityTooLarge = row.densityTooLarge
      self.inConfigForceLoad = row.configForceLoad
      self.inAdapterLimit = row.adapterLimit
      self.inSpanBp = row.spanBp
    },
    // Nothing wipes the estimate this is handed: the fork fires `afterAttach`
    // on attachment, and a root fixture is never attached, so the tier-swap
    // autorun that would clear it is not installed here at all.
    setRuntime(state: {
      forceLoadTrack: boolean
      byteEstimate: ByteEstimate | undefined
      gateMeasuredViewportKey: string | undefined
    }) {
      self.forceLoadTrack = state.forceLoadTrack
      self.byteEstimate = state.byteEstimate
      self.gateMeasuredViewportKey = state.gateMeasuredViewportKey
    },
  }))

const CONFIG_LIMIT = 1_000_000

interface Row {
  gateEnabled: boolean
  densityTooLarge: boolean
  configForceLoad: boolean
  forceLoadTrack: boolean
  spanBp: number | undefined
  adapterLimit: number | undefined
  bytes: number | undefined
  zoomIneffective: boolean
  stale: boolean
}

interface Out {
  gateEnabled: boolean
  gateExempt: boolean
  aboveFloor: boolean
  gateActive: boolean
  densityGateActive: boolean
  byteLimit: number | undefined
  tooLarge: boolean
  axis: string
  reason: string
  zoomCanRelease: boolean
  measurementStale: boolean
  skipsMeasured: boolean
}

const BOOLS = [false, true]
const SPANS = [
  undefined,
  1_000,
  AUTO_FORCE_LOAD_BP - 1,
  AUTO_FORCE_LOAD_BP,
  100_000,
]
const ADAPTER_LIMITS = [undefined, -1, 0, 500_000, 4_000_000]
// Straddles every budget the rows can resolve to: 500k, 1M, 2M (the sub-floor
// tier over the config limit), 4M and 8M.
const BYTES = [
  undefined,
  0,
  499_999,
  500_000,
  500_001,
  1_000_000,
  1_000_001,
  2_000_000,
  2_000_001,
  4_000_001,
  8_000_001,
]

function enumerateRows() {
  const rows: Row[] = []
  for (const gateEnabled of BOOLS) {
    for (const densityTooLarge of BOOLS) {
      for (const configForceLoad of BOOLS) {
        for (const forceLoadTrack of BOOLS) {
          for (const spanBp of SPANS) {
            for (const adapterLimit of ADAPTER_LIMITS) {
              for (const bytes of BYTES) {
                for (const zoomIneffective of bytes === undefined
                  ? [false]
                  : BOOLS) {
                  for (const stale of BOOLS) {
                    rows.push({
                      gateEnabled,
                      densityTooLarge,
                      configForceLoad,
                      forceLoadTrack,
                      spanBp,
                      adapterLimit,
                      bytes,
                      zoomIneffective,
                      stale,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return rows
}

// ONE NODE FOR ALL 16,800 ROWS, rewritten per row. A node per row was 9.1s of
// this suite against 0.6s of test bodies, all of it MST instantiation and all of
// it at module load. Nothing carries between rows: the six inputs and all
// three volatiles are written every time, and the mixin has no other state.
const display = TruthTableDisplay.create({
  inGateEnabled: false,
  inDensityTooLarge: false,
  inConfigForceLoad: false,
  inConfigLimit: CONFIG_LIMIT,
})

function evaluate(row: Row): Out {
  display.setInputs(row)
  display.setRuntime({
    forceLoadTrack: row.forceLoadTrack,
    byteEstimate:
      row.bytes === undefined
        ? undefined
        : {
            bytes: row.bytes,
            measuredSpanBp: row.spanBp ?? 0,
            zoomIneffective: row.zoomIneffective,
          },
    gateMeasuredViewportKey: row.stale ? 'somewhere-else' : VIEWPORT_KEY,
  })
  return {
    gateEnabled: display.gateEnabled,
    gateExempt: display.gateExempt,
    aboveFloor: display.aboveForceLoadFloor,
    gateActive: display.gateActive,
    densityGateActive: display.densityGateActive,
    byteLimit: display.resolvedByteLimit(),
    tooLarge: display.regionTooLarge,
    axis: display.tooLargeStatus.axis ?? '-',
    reason: display.regionTooLargeReason,
    zoomCanRelease: display.zoomCanReleaseGate,
    measurementStale: display.gateMeasurementStale,
    skipsMeasured: display.gateSkipsMeasuredViewport,
  }
}

const rows = enumerateRows()
const table = rows.map(row => ({ row, out: evaluate(row) }))

function outKey(out: Out) {
  return [
    `gateEnabled=${out.gateEnabled}`,
    `gateExempt=${out.gateExempt}`,
    `aboveFloor=${out.aboveFloor}`,
    `gateActive=${out.gateActive}`,
    `densityGateActive=${out.densityGateActive}`,
    `byteLimit=${out.byteLimit}`,
    `tooLarge=${out.tooLarge}`,
    `axis=${out.axis}`,
    `zoomCanRelease=${out.zoomCanRelease}`,
    `stale=${out.measurementStale}`,
    `skips=${out.skipsMeasured}`,
  ].join(' ')
}

// What a *consumer* of the gate can tell apart. The golden key above names
// every intermediate getter as well, which is what makes it a tripwire — but it
// is also why the count reads as a subsystem with 55 states, and that is not
// what anyone downstream sees. `DisplayChrome` and the fetch autoruns read four
// things between them, and they take **7** distinct combinations over all 16,800
// rows; the worker budget's five values are what take that to 32.
function bannerKey(out: Out) {
  return [
    `tooLarge=${out.tooLarge}`,
    `axis=${out.axis}`,
    `zoomCanRelease=${out.zoomCanRelease}`,
    `skips=${out.skipsMeasured}`,
  ].join(' ')
}

function observableKey(out: Out) {
  return [`byteLimit=${out.byteLimit}`, bannerKey(out)].join(' ')
}

function rowKey(row: Row) {
  return [
    `gateEnabled=${row.gateEnabled}`,
    `densityTooLarge=${row.densityTooLarge}`,
    `cfgForceLoad=${row.configForceLoad}`,
    `forceLoadTrack=${row.forceLoadTrack}`,
    `span=${row.spanBp}`,
    `adapterLimit=${row.adapterLimit}`,
    `bytes=${row.bytes}`,
    `zoomIneffective=${row.zoomIneffective}`,
    `stale=${row.stale}`,
  ].join(' ')
}

describe('the gate truth table', () => {
  it('collapses to a stable set of behaviors', () => {
    const groups = new Map<string, { count: number; first: Row }>()
    for (const { row, out } of table) {
      const key = outKey(out)
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
      } else {
        groups.set(key, { count: 1, first: row })
      }
    }
    const banner = [...new Set(table.map(t => bannerKey(t.out)))].sort()
    const observable = new Set(table.map(t => observableKey(t.out)))
    const lines = [
      `rows: ${rows.length}`,
      `distinct behaviors: ${groups.size}`,
      `distinct observable behaviors: ${observable.size}`,
      `distinct banner-facing states: ${banner.length}`,
      '',
      ...banner.map(b => `  ${b}`),
      '',
      ...[...groups.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .flatMap(([key, { count, first }]) => [
          `${key}   x${count}`,
          `  e.g. ${rowKey(first)}`,
        ]),
      '',
    ]
    const golden = join(__dirname, 'gateTruthTable.golden.txt')
    // Read BEFORE the write, or the assertion is against what this run just
    // produced and the check certifies itself: with the var exported, an
    // operator flip in the gate rewrites the golden and stays green.
    const recorded = readFileSync(golden, 'utf8')
    if (process.env.UPDATE_GATE_GOLDEN) {
      writeFileSync(golden, lines.join('\n'))
    }
    expect(lines.join('\n')).toBe(recorded)
  })
})

// The properties a reader of the banner actually relies on. Each one is checked
// against every row, so a violation names the corner it happens in.
describe('gate invariants', () => {
  function violations(predicate: (t: { row: Row; out: Out }) => boolean) {
    return table.filter(t => !predicate(t)).map(t => rowKey(t.row))
  }

  // Several invariants below are "these two facts are present together or not at
  // all", which is an `===` between two booleans — and written inline, one of
  // them a comparison, that reads to `unicorn/no-chained-comparison` as `a === b
  // !== c`. Named, it also says what it is checking.
  const together = (a: boolean, b: boolean) => a === b

  it('a gated display always says why, and an ungated one never does', () => {
    expect(
      violations(
        ({ out }) =>
          together(out.tooLarge, out.reason !== '') &&
          together(out.tooLarge, out.axis !== '-'),
      ),
    ).toEqual([])
  })

  it('force-load exempts the track on both axes', () => {
    expect(
      violations(
        ({ row, out }) =>
          !(row.configForceLoad || row.forceLoadTrack) || !out.tooLarge,
      ),
    ).toEqual([])
  })

  it('a display that did not opt in never gates', () => {
    expect(
      violations(({ row, out }) => row.gateEnabled || !out.tooLarge),
    ).toEqual([])
  })

  it('an unmeasured view never gates', () => {
    expect(
      violations(({ row, out }) => row.spanBp !== undefined || !out.tooLarge),
    ).toEqual([])
  })

  it('a worker budget exists exactly when the gate may act', () => {
    expect(
      violations(({ out }) =>
        together(out.byteLimit !== undefined, out.gateActive),
      ),
    ).toEqual([])
  })

  it('a non-positive adapter limit is no opinion, not a limit of zero', () => {
    const byRest = new Map<string, Set<string>>()
    for (const { row, out } of table) {
      if (row.adapterLimit === undefined || row.adapterLimit <= 0) {
        const rest = rowKey({ ...row, adapterLimit: 999 })
        const set = byRest.get(rest) ?? new Set()
        set.add(outKey(out))
        byRest.set(rest, set)
      }
    }
    expect(
      [...byRest].filter(([, set]) => set.size > 1).map(([k]) => k),
    ).toEqual([])
  })

  it('skipping the fetch implies the banner is up', () => {
    expect(violations(({ out }) => !out.skipsMeasured || out.tooLarge)).toEqual(
      [],
    )
  })

  it('"zoom in" is only ever withheld from a byte-gated display', () => {
    expect(
      violations(({ out }) => out.zoomCanRelease || out.axis === 'bytes'),
    ).toEqual([])
  })

  it('more bytes never gates less', () => {
    const bad: string[] = []
    const index = new Map(table.map(t => [rowKey(t.row), t.out]))
    for (const { row, out } of table) {
      if (row.bytes === undefined) {
        continue
      }
      for (const bigger of BYTES) {
        if (bigger === undefined || bigger <= row.bytes) {
          continue
        }
        const other = index.get(rowKey({ ...row, bytes: bigger }))
        if (other && out.tooLarge && !other.tooLarge) {
          bad.push(`${rowKey(row)} -> bytes=${bigger}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('a larger byte budget never gates more', () => {
    const bad: string[] = []
    const index = new Map(table.map(t => [rowKey(t.row), t.out]))
    for (const { row, out } of table) {
      // undefined and the non-positive sentinels all mean "use the config
      // limit", so compare only among the limits that are genuinely a number
      if (row.adapterLimit === undefined || row.adapterLimit <= 0) {
        continue
      }
      for (const bigger of ADAPTER_LIMITS) {
        if (bigger === undefined || bigger <= row.adapterLimit) {
          continue
        }
        const other = index.get(rowKey({ ...row, adapterLimit: bigger }))
        if (other && !out.tooLarge && other.tooLarge) {
          bad.push(`${rowKey(row)} -> adapterLimit=${bigger}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('zooming in never turns an ungated region into a gated one', () => {
    const bad: string[] = []
    const index = new Map(table.map(t => [rowKey(t.row), t.out]))
    const measured = SPANS.filter(s => s !== undefined)
    for (const { row, out } of table) {
      if (row.spanBp === undefined) {
        continue
      }
      for (const smaller of measured) {
        if (smaller >= row.spanBp) {
          continue
        }
        const other = index.get(rowKey({ ...row, spanBp: smaller }))
        if (other && !out.tooLarge && other.tooLarge) {
          bad.push(`${rowKey(row)} -> span=${smaller}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
