import { measuredBytes, measurementPartial } from '@jbrowse/core/rpc/byteBudget'

import type { GateCommitHost, GateFetchState } from './regionTooLargeUtils.ts'

/**
 * What one fetch measured, as one value: the bytes per region, and whether
 * they cover the region set the fetch asked about.
 *
 * One value rather than two arguments because the two came apart. `partial`
 * used to be a trailing optional on `commitFetchBytes`, so a runner could
 * commit the number and say nothing about it — which three of the four did,
 * and MAF's two tiers, whose `refusalScope` aborts the siblings at the first
 * refusal, are the ones whose number is genuinely partial. A measurement is
 * now built by one of the constructors below and travels whole.
 */
export interface GateMeasurement {
  perRegionBytes: (number | undefined)[]
  /**
   * The fan-out behind the bytes stopped early, so the largest is the largest
   * among whichever regions won the race. `nextByteEstimate` will not read one
   * as evidence about zoom: comparing chr1's bytes at one viewport against
   * chr4's at the next clears the 90% bar on that alone.
   */
  partial: boolean
}

/**
 * One payload's measurement. A runner holding a single answer cannot derive
 * whether the set reported — it issued one call — so it reads what the answer
 * claims.
 */
export function measurementOf(result: unknown): GateMeasurement {
  return {
    perRegionBytes: [measuredBytes(result)],
    partial: measurementPartial(result),
  }
}

/**
 * One result per region, so the set reported by construction and nothing is
 * partial unless a result says its own number was.
 */
export function measurementOfEach(
  results: readonly unknown[],
): GateMeasurement {
  return {
    perRegionBytes: results.map(measuredBytes),
    partial: results.some(measurementPartial),
  }
}

/**
 * The gate bookkeeping one fetch owes, opened before the fetch is issued and
 * closed by its first commit. **Every fetch in the tree goes through this**;
 * nothing in production calls `commitFetchBytes` itself, which is what keeps
 * the measurement and the claim about it from coming apart again.
 *
 * Two rules, both the kind a reader restores wrongly and no type catches:
 *
 * - **`issued` is captured on construction**, before anything is issued, so
 *   the measurements that come back are judged against the viewport and the
 *   adapter tier they were asked for rather than whatever the view moved to
 *   during the round trip.
 * - **The commit happens at most once.** Several regions refusing in one batch
 *   is the ordinary case at whole-genome zoom, and a commit per refusal is a
 *   `fetchGeneration` bump per refusal — a burst of autorun re-runs where one
 *   is owed. Held here rather than inferred from `ctx.isStale()`, which would
 *   make the count depend on `cancelFetch` closing the rotation's guard: true
 *   of `FetchMixin`, but a cross-member contract nothing checks.
 *
 * The third rule — a refusal commits before it cancels — belongs to the runner
 * that has siblings to cancel, and lives at `gateBatch` in `fetchEachRegion`.
 */
export function openGateCommit(self: GateCommitHost) {
  const issued = self.gateFetchState()
  let settled = false
  return {
    /** the gate as it stood when this fetch was issued */
    issued,
    /** Answers whether this call was the commit, for a caller sequencing one. */
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
