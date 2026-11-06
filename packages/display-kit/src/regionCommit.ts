import { getType } from '@jbrowse/mobx-state-tree'
import { reportContractViolation } from '@jbrowse/render-core/contractReports'

import type { FetchContext } from './FetchMixin.ts'
import type { FetchInputs } from './fetchInputs.ts'
import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter/zoomRange'
import type { Region } from '@jbrowse/core/util/types/data'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A region a fetch stored and the inputs it was stored under, as one record so
 * the span, the stamp and the payload cannot disagree.
 */
export interface LoadedRegion extends Region {
  /**
   * The inputs the storing fetch was issued under, as the two tiers
   * `MultiRegionDisplayMixin.fetchInputs` publishes, so `staleSettingsDrawn`
   * can compare the settings tier alone.
   */
  fetchInputs: FetchInputs
  /**
   * The payload that fetch stored. Optional only for the raw
   * `setLoadedRegion` write a test stages; `commitRegion` requires it.
   */
  payload?: RegionPayload
}

/**
 * What a fetch stores for a region: anything but `undefined`, so a commit
 * cannot claim a region and store nothing. A batched fetch stores the batch
 * under each region it covered.
 */
export type RegionPayload = NonNullable<unknown>

function isZoomRange(value: unknown): value is ZoomRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'minBpPerPx' in value &&
    typeof value.minBpPerPx === 'number' &&
    'maxBpPerPx' in value &&
    typeof value.maxBpPerPx === 'number'
  )
}

/**
 * Whether a stored payload still answers at `bpPerPx`: a payload carrying the
 * `zoomRange` its adapter declared answers inside it, and one carrying none
 * answers at every zoom.
 */
export function payloadServesZoom(payload: RegionPayload, bpPerPx: number) {
  if (typeof payload !== 'object' || !('zoomRange' in payload)) {
    return true
  }
  const { zoomRange } = payload
  return (
    !isZoomRange(zoomRange) ||
    (zoomRange.minBpPerPx <= bpPerPx && bpPerPx < zoomRange.maxBpPerPx)
  )
}

/**
 * A {@link FetchContext} plus what only a per-region fetch can do: record that
 * a region is loaded.
 *
 * Call `commitRegion` where the payload is stored. `loadedRegions` is the span
 * `isBlockCovered` judges the viewport against, so it must describe data that
 * exists: a region marked loaded that holds nothing (one the size gate
 * refused, say) reads as covered, nothing refetches, and the gate never
 * re-measures. The span is not a parameter: `commitRegion` names an index,
 * resolved against the list `fetchRegions` issued, so a fetch cannot claim a
 * span it never asked for. The runners in `fetchEachRegion.ts` make the call;
 * `setLoadedRegion` is the raw write underneath, for tests.
 */
export interface RegionFetchContext extends FetchContext {
  /**
   * Store this region's payload over the span this fetch issued for it.
   * Ignored once the fetch is stale.
   */
  commitRegion: (displayedRegionIndex: number, payload: RegionPayload) => void
}

/**
 * The two ways a commit goes wrong, both counted so they report in production
 * too:
 *
 * - naming a region the fetch never asked for, whose commit is dropped;
 * - never committing, which spins: nothing reads as covered, so the plan asks
 *   again after every fetch. Reported after three ungated empty fetches in a
 *   row, since the worker's live `bpPerPx` can legitimately refuse one cycle
 *   before the debounced verdict catches up.
 */
export function makeCommitChecks(self: IStateTreeNode) {
  let emptyFetchRuns = 0
  return {
    unknownRegion(displayedRegionIndex: number, issued: Iterable<number>) {
      reportContractViolation(
        'display',
        `commitRegion(${displayedRegionIndex}) names ` +
          `a region this fetch did not ask for (it issued ` +
          `${[...issued].join(', ') || 'none'}), so nothing was marked loaded. ` +
          `See RegionFetchContext.`,
      )
    },
    fetchEnded({ committed, gated }: { committed: number; gated: boolean }) {
      emptyFetchRuns = committed === 0 && !gated ? emptyFetchRuns + 1 : 0
      if (emptyFetchRuns === 3) {
        reportContractViolation(
          'display',
          `${getType(self).name}: three fetches in a ` +
            `row stored data for no region and nothing is gating them, so the ` +
            `plan will keep asking for the same regions. A work callback that ` +
            `stores a payload must call ` +
            `\`ctx.commitRegion(displayedRegionIndex)\` beside the store — see ` +
            `RegionFetchContext.`,
        )
      }
    },
  }
}
