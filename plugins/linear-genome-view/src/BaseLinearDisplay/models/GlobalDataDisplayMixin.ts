import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import { isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface FetchContext {
  stopToken: StopToken
  generation: number
  isStale: () => boolean
}

/**
 * Mixin for GPU displays that hold a single global (non-regional) dataset —
 * HiC contact matrix, LD triangle, variant matrix, etc.
 *
 * Provides:
 *   - GpuBackendLifecycleSlotMixin (startSingleDataGpuLifecycle, renderNow, …)
 *   - RegionTooLargeMixin (regionTooLarge, regionCannotBeRendered, …)
 *   - withFetchLifecycle — cancel-safe fetch wrapper (same staleness contract
 *     as MultiRegionDisplayMixin but without region tracking)
 *   - error, statusMessage, isLoading
 *
 * Unlike MultiRegionDisplayMixin, this mixin owns no per-region state and
 * installs no autoruns. Fetch triggering is left entirely to the display's
 * own afterAttach autorun so each display can express its own trigger
 * conditions (HiC: viewport change; LD: viewport + showLDTriangle + etc).
 */
export default function GlobalDataDisplayMixin() {
  return types
    .compose(
      'GlobalDataDisplayMixin',
      RegionTooLargeMixin(),
      GpuBackendLifecycleSlotMixin(),
      types.model({}),
    )
    .volatile(() => ({
      error: undefined as unknown,
      renderingStopToken: undefined as StopToken | undefined,
      fetchGeneration: 0,
      statusMessage: undefined as string | undefined,
    }))
    .views(self => ({
      get isLoading() {
        return self.renderingStopToken !== undefined
      },
    }))
    .actions(self => ({
      setError(error?: unknown) {
        self.error = error
      },
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },
      setRenderingStopToken(token: StopToken | undefined) {
        self.renderingStopToken = token
      },
    }))
    .actions(self => {
      function finishLoading() {
        self.setRenderingStopToken(undefined)
        self.setStatusMessage(undefined)
      }

      return {
        withFetchLifecycle(work: (ctx: FetchContext) => Promise<void>) {
          if (self.renderingStopToken) {
            stopStopToken(self.renderingStopToken)
          }
          const stopToken = createStopToken()
          const generation = self.fetchGeneration
          self.setRenderingStopToken(stopToken)
          self.setError(undefined)

          const isStale = () =>
            !isAlive(self) ||
            self.fetchGeneration !== generation ||
            self.renderingStopToken !== stopToken

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              await work({ stopToken, generation, isStale })
            } catch (e) {
              if (!isAbortException(e)) {
                console.error('Fetch failed:', e)
                if (!isStale()) {
                  self.setError(e)
                }
              }
            } finally {
              if (!isStale()) {
                finishLoading()
                // Bump so the fetch autorun re-evaluates if the viewport
                // moved while the fetch was in flight.
                self.fetchGeneration++
              }
            }
          })()
        },
      }
    })
}

export type GlobalDataDisplayMixinType = ReturnType<typeof GlobalDataDisplayMixin>
