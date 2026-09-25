import { measuredBytes, measurementPartial } from '@jbrowse/core/rpc/byteBudget'

import type { GateCommitHost, GateFetchState } from './regionTooLargeUtils.ts'

/**
 * What one fetch measured: the bytes per region and whether they cover the set
 * it asked about. One value, because as two arguments the second was a
 * trailing optional three of the four runners never passed.
 */
export interface GateMeasurement {
  perRegionBytes: (number | undefined)[]
  /** the fan-out stopped early, so `nextByteEstimate` takes no zoom evidence */
  partial: boolean
}

/** One payload: the runner issued one call, so it reads the claim off it. */
export function measurementOf(result: unknown): GateMeasurement {
  return {
    perRegionBytes: [measuredBytes(result)],
    partial: measurementPartial(result),
  }
}

/** One result per region, so the set reported unless a result says otherwise. */
export function measurementOfEach(
  results: readonly unknown[],
): GateMeasurement {
  return {
    perRegionBytes: results.map(measuredBytes),
    partial: results.some(measurementPartial),
  }
}

/**
 * The gate bookkeeping one fetch owes. Every fetch goes through this; nothing
 * in production calls `commitFetchBytes` itself.
 *
 * `issued` is captured before the fetch, so what comes back is judged against
 * the viewport and tier it was asked for. The commit happens at most once —
 * several regions refusing in one batch is ordinary at whole-genome zoom, and
 * each commit bumps `fetchGeneration`. A refusal commits before it cancels,
 * which is `gateBatch`'s rule since only it has siblings to cancel.
 */
export function openGateCommit(self: GateCommitHost) {
  const issued = self.gateFetchState()
  let settled = false
  return {
    issued,
    /** true when this call was the commit */
    commit(measurement: GateMeasurement): boolean {
      if (settled) {
        return false
      }
      settled = true
      self.commitFetchBytes(
        measurement.perRegionBytes,
        issued,
        measurement.partial,
      )
      return true
    },
  }
}

export type GateCommit = ReturnType<typeof openGateCommit>
export type { GateCommitHost, GateFetchState }
