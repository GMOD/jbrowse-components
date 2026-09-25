/**
 * The three rules every fetch runner used to restate, now in one object. Each
 * was a real defect in at least one runner before it moved here, so each gets
 * a test rather than a comment.
 */
import {
  measurementOf,
  measurementOfEach,
  openGateCommit,
} from './gateCommit.ts'

import type { GateFetchState } from './regionTooLargeUtils.ts'

function viewportAt(key: string): GateFetchState {
  return { viewport: { spanBp: 100, key }, gated: true, tierKey: undefined }
}

function host(state: () => GateFetchState) {
  const commits: {
    perRegionBytes: (number | undefined)[]
    issued: GateFetchState
    partial: boolean
  }[] = []
  return {
    commits,
    self: {
      gateFetchState: state,
      commitFetchBytes: (
        perRegionBytes: (number | undefined)[],
        issued: GateFetchState,
        partial = false,
      ) => {
        commits.push({ perRegionBytes, issued, partial })
      },
    },
  }
}

// Re-reading at commit stamps a measurement onto a viewport nobody measured,
// which `gateSkipsMeasuredViewport` then reads as "nothing left to learn".
test('captures the gate state at open, not at commit', () => {
  let live = viewportAt('chr1:0-100')
  const { commits, self } = host(() => live)
  const gate = openGateCommit(self)
  live = viewportAt('chr4:0-100')
  gate.commit(measurementOf({ bytes: 10 }))
  expect(commits).toHaveLength(1)
  expect(commits[0]!.issued.viewport?.key).toBe('chr1:0-100')
})

// Several regions refusing in one batch is ordinary at whole-genome zoom, and
// every commit bumps `fetchGeneration`.
test('commits at most once, and says which call was the commit', () => {
  const { commits, self } = host(() => viewportAt('chr1:0-100'))
  const gate = openGateCommit(self)
  expect(gate.commit(measurementOf({ bytes: 10 }))).toBe(true)
  expect(gate.commit(measurementOf({ bytes: 20 }))).toBe(false)
  expect(commits).toHaveLength(1)
  expect(commits[0]!.perRegionBytes).toEqual([10])
})

// Reading the number without the claim is what let MAF's two tiers report one
// region's bytes as a measurement of the whole set.
describe('a measurement carries whether it covers the set', () => {
  test('one payload is told, and defaults to whole', () => {
    expect(measurementOf({ bytes: 9e9, partial: true })).toEqual({
      perRegionBytes: [9e9],
      partial: true,
    })
    expect(measurementOf({ bytes: 10 })).toEqual({
      perRegionBytes: [10],
      partial: false,
    })
    expect(measurementOf({ regionTooLarge: true })).toEqual({
      perRegionBytes: [undefined],
      partial: false,
    })
  })

  test('one result per region reported the set by construction', () => {
    expect(measurementOfEach([{ bytes: 10 }, { bytes: 20 }])).toEqual({
      perRegionBytes: [10, 20],
      partial: false,
    })
    expect(
      measurementOfEach([{ bytes: 10 }, { bytes: 20, partial: true }]).partial,
    ).toBe(true)
  })
})
