/**
 * The dev-only check on what may be stored as a region's payload.
 *
 * Every per-region display keys its worker results by `displayedRegionIndex` in
 * a map built here, and every reader of one is written for the payload shape. No
 * type catches a value that is not one: `onResult` is handed whatever the RPC
 * resolved, typed as the payload it was supposed to be. When the display test
 * harness resolved `undefined` for un-stubbed methods, six reactions across four
 * packages threw `Cannot read properties of undefined` on every run, inside
 * autoruns MobX catches and logs.
 *
 * Reports through `console.error` rather than throwing, because this runs inside
 * the fetch's own result handler where a throw is caught and reported as a
 * failed region — hiding the violation. That makes the channel part of the
 * contract, so these assert on it through the jest gate's opt-in.
 */
import { types } from '@jbrowse/mobx-state-tree'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import {
  installPerRegionLifecycle,
  regionDataMap,
} from './installPerRegionLifecycle.ts'

function captureReports(fn: () => void) {
  fn()
  return takeContractReports()
}

test('a payload is stored without complaint', () => {
  const reports = captureReports(() => {
    const map = regionDataMap<{ features: number[] }>('rpcDataMap')
    map.set(0, { features: [1, 2] })
  })

  expect(reports).toEqual([])
})

test('an absent payload is reported, and names the map and the region', () => {
  const reports = captureReports(() => {
    const map = regionDataMap<{ features: number[] }>('rpcDataMap')
    // the shape the harness's un-stubbed RPC resolved for as long as it existed
    map.set(3, undefined as unknown as { features: number[] })
  })

  expect(reports).toHaveLength(1)
  expect(reports[0]).toContain('rpcDataMap')
  expect(reports[0]).toContain('region 3')
  expect(reports[0]).toContain('undefined')
})

test('null is reported as itself rather than as an object', () => {
  const reports = captureReports(() => {
    const map = regionDataMap<object>('summaryDataMap')
    map.set(1, null as unknown as object)
  })

  expect(reports).toHaveLength(1)
  expect(reports[0]).toContain('null')
})

// The store still happens: this is a report, not a guard. A display that
// somehow reaches here keeps whatever behaviour it had, so turning the check on
// could not itself change what anything draws.
test('the value is stored anyway', () => {
  const map = regionDataMap<object>('rpcDataMap')
  captureReports(() => {
    map.set(0, undefined as unknown as object)
  })

  expect(map.has(0)).toBe(true)
  expect(map.get(0)).toBeUndefined()
})

// The same invariant at the other enforcement point. `regionDataMap` is only
// the most common implementation of `data: () => ReadonlyMap<number, Data>` —
// two displays derive theirs off a computed instead, and a map built that way
// reaches the encode, the upload and every renderer having been checked by
// nothing.
describe('the map handed to installPerRegionLifecycle', () => {
  const TestModel = types
    .compose('TestModel', RenderLifecycleMixin(), types.model({}))
    .volatile(() => ({}))

  const backend = {
    uploadRegion: () => {},
    pruneRegions: () => {},
  }

  function installOver(data: ReadonlyMap<number, object>) {
    installPerRegionLifecycle(TestModel.create(), backend, {
      data: () => data,
      render: () => true,
    })
  }

  test('a derived map is checked too, and names the display', () => {
    const derived = new Map<number, object>([
      [0, { features: [] }],
      [4, undefined as unknown as object],
    ])

    const reports = captureReports(() => {
      installOver(derived)
    })

    expect(reports).toHaveLength(1)
    expect(reports[0]).toContain('TestModel')
    expect(reports[0]).toContain('region 4')
    expect(reports[0]).toContain('undefined')
  })

  // The two points partition the maps rather than both reporting the same
  // entry: a `regionDataMap` has already named the field it is stored on, which
  // is the better blame, and the upload autorun re-runs on every recompute.
  test('a regionDataMap is left to its own check', () => {
    const stored = regionDataMap<object>('rpcDataMap')

    const atTheStore = captureReports(() => {
      stored.set(2, undefined as unknown as object)
    })
    const atTheUpload = captureReports(() => {
      installOver(stored)
    })

    expect(atTheStore).toHaveLength(1)
    expect(atTheUpload).toEqual([])
  })
})

// Typecheck-only, and the half the runtime check cannot state for itself. The
// check reports a value that is not a non-null object; `T extends object` is
// that same predicate as a constraint, so a map cannot be DECLARED as holding
// what every store of it would then be reported for. The required `name` is the
// other half — an omitted one reports anonymously, which is what the parameter
// exists to prevent. An unused `@ts-expect-error` fails `pnpm typecheck`, so
// both assert without running.
function theDeclarationCannotSayWhatTheCheckReports() {
  // @ts-expect-error a nullable payload is the violation, not a declaration
  const nullable = regionDataMap<{ features: number[] } | undefined>('rpcData')
  // @ts-expect-error every map names the field it is stored on
  const unnamed = regionDataMap<{ features: number[] }>()
  return [nullable.size, unnamed.size]
}

test('a map cannot be declared as holding what the check reports', () => {
  // the assertion is the two directives above; running the accepted half pins
  // them against a call that really exists
  expect(theDeclarationCannotSayWhatTheCheckReports()).toEqual([0, 0])
})
