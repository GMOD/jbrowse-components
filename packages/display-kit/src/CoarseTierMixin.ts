import { readConfObject } from '@jbrowse/core/configuration'
import { isSubAdapterConfig } from '@jbrowse/core/data_adapters/BaseAdapter'
import { isRegionRefused, measuredBytes } from '@jbrowse/core/rpc/byteBudget'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'
import { adapterConfigKey } from '@jbrowse/core/util/adapterConfigKey'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { types } from '@jbrowse/mobx-state-tree'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'

import {
  coarseTierCovers,
  resolveCoarseTier,
  resolveFetchSuspended,
} from './coarseTier.ts'
import {
  coarseTierDisplayPhase,
  coarseTierSvgReady,
} from './coarseTierPhase.ts'
import { onDisplayedRegionsChange } from './displayAutoruns.ts'

import type {
  CoarseTierEntry,
  CoarseTierMode,
  CoarseTierRead,
  CoarseTierResult,
} from './coarseTier.ts'
import type { CoarseTierPhaseHost } from './coarseTierPhase.ts'
import type { RegionHost } from './regionHost.ts'
import type { GateCommitHost, GateFetchState } from './regionTooLargeUtils.ts'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { StatusWindow } from '@jbrowse/core/util/progress'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What `CoarseTierMixin` reads off its host: the gate's verdict and commit pair
 * from `RegionTooLargeMixin`, the fetch skeleton's terms from `FetchMixin` and
 * `BaseDisplay`, and the phase foundation the tier's own phase post-processes.
 */
export interface CoarseTierHost
  extends
    Omit<FetchSkeletonHost, 'fetchCanceled'>,
    Omit<
      CoarseTierPhaseHost,
      | 'coarseTierRead'
      | 'coarseTierLoading'
      | 'coarseTierStandsIn'
      | 'gateMeasuresCoarse'
    >,
    GateCommitHost {
  setError: (error?: unknown) => void
  isMinimized: boolean
  statusWindow: StatusWindow
}

function host(self: object) {
  return self as CoarseTierHost
}

function phaseHost(self: object) {
  return self as CoarseTierPhaseHost
}

function view(self: object) {
  return getContainingView(self) as RegionHost
}

/**
 * The zoomed-out tier a display draws in place of its detail: the density
 * band's bins, MAF's summary bars. The verdict stays exactly what
 * `RegionTooLargeMixin` derives, and this mixin adds the swap decision, the
 * per-region payloads and the read that fills them, through the shared fetch
 * skeleton on its own rotation so the detail fetch's cancel never reaches it.
 *
 * The payloads live beside the foundation's per-region store, never in it,
 * and the read records its own span: the two tiers fetch different widths of
 * the same `displayedRegionIndex`, so one `loadedRegions` entry stamped by
 * both narrowed the coarse span to the detail's on every zoom in and re-read
 * the coarse adapter about an octave back out. The detail store keeps its
 * entries under the tier — a display masks them where it draws, and zooming
 * back in draws what it held.
 *
 * A display states its tier through the hooks below: the adapter slot the
 * source sits on, the mode, its own threshold, whether the byte gate measures
 * the coarse read, what its read depends on beyond the span, and the read
 * itself. Composed after `MultiRegionDisplayMixin`, so its `displayPhase` and
 * `svgReady` are the ones `types.compose` keeps.
 *
 * #stateModel CoarseTierMixin
 * #category display
 */
export default function CoarseTierMixin<P extends object>() {
  return types
    .model('CoarseTierMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * The coarse payload by `displayedRegionIndex`, over the regions the last
       * read was issued for. Cleared on chromosome navigation.
       */
      coarseTier: regionDataMap<P>('coarseTier'),
      /**
       * #volatile
       * What the held payloads were read over — the buffered regions and the
       * read key — so a pan or a zoom inside them re-reads nothing. Undefined
       * until a read lands.
       */
      coarseTierRead: undefined as CoarseTierRead | undefined,
      /**
       * #volatile
       */
      coarseTierLoading: false,
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook (default none): the slot on the track's adapter the
       * coarse source sits in — `densityAdapter`, `summaryAdapter`. With no
       * slot there is no source and the tier never stands in.
       */
      get coarseAdapterSlot(): string | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook (default `auto`): the user's override, where the
       * display offers one.
       */
      get coarseTierMode(): CoarseTierMode {
        return 'auto'
      },
      /**
       * #getter
       * Overridable hook (default false): the display's own line past which
       * `auto` swaps before the gate refuses anything — a bp/px slot, a span
       * floor.
       */
      get coarseTierPastThreshold(): boolean {
        return false
      },
      /**
       * #getter
       * Overridable hook (default false): the coarse read is a feature
       * download the byte gate has to measure. The gate then measures the
       * coarse adapter while the tier is up, its refusal is the banner, the
       * detail fetch stands down outright since the coarse read is the
       * measurement pass, and the swap is by threshold alone — the verdict is
       * about whichever tier is up, so it cannot also pick the tier. A read
       * bounded by construction (bins per screen pixel) leaves this off.
       */
      get coarseTierGated(): boolean {
        return false
      },
      /**
       * #getter
       * Overridable hook (default `''`): what the read depends on beyond its
       * span and its adapter — a zoom bucket, a settings key. A held read whose
       * key differs re-reads.
       */
      get coarseReadKey(): string {
        return ''
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The coarse source's config, read off the live track config so a
       * re-pointed adapter follows.
       */
      get coarseSourceConfig(): unknown {
        const slot = self.coarseAdapterSlot
        return slot === undefined
          ? undefined
          : readConfObject(getContainingTrack(self).configuration, [
              'adapter',
              slot,
            ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasCoarseSource() {
        return isSubAdapterConfig(self.coarseSourceConfig)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the coarse tier stands in for the detail right now.
       */
      get coarseTierActive() {
        return resolveCoarseTier({
          mode: self.coarseTierMode,
          hasSource: self.hasCoarseSource,
          gateRefusesDetail: self.coarseTierGated
            ? false
            : host(self).regionTooLarge,
          pastThreshold: self.coarseTierPastThreshold,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook (default: the tier's verdict) — whether the tier is
       * standing in for the detail on screen right now. A display whose tier
       * needs somewhere to draw narrows it: canvas adds the view geometry the
       * draw is mapped through, alignments the coverage band that can be
       * hidden.
       */
      get coarseTierStandsIn(): boolean {
        return self.coarseTierActive
      },
      /**
       * #getter
       * The byte gate is measuring the coarse read rather than the detail
       * fetch, so its verdict is about the tier on screen.
       */
      get gateMeasuresCoarse() {
        return self.coarseTierGated && self.coarseTierActive
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `RegionTooLargeMixin`'s hook: measure the adapter of the fetch that is
       * about to run, so the estimate and the budget describe one file.
       */
      get byteGateAdapterPath(): string[] {
        return self.gateMeasuresCoarse
          ? ['adapter', self.coarseAdapterSlot!]
          : ['adapter']
      },
      /**
       * #getter
       * The gate's refusal is about the detail fetch, so that fetch owes the
       * re-measure the gate releases through.
       */
      get gateRefusesDetail() {
        return host(self).regionTooLarge && !self.gateMeasuresCoarse
      },
      /**
       * #getter
       * The whole key a read is held under: the coarse adapter and the
       * display's own term.
       */
      get coarseTierIssueKey() {
        const source = self.coarseSourceConfig
        const adapter = isSubAdapterConfig(source)
          ? adapterConfigKey(source)
          : ''
        return `${adapter}|${self.coarseReadKey}`
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over
       * `coarseTierStandsIn`.
       */
      get fetchSuspended() {
        return resolveFetchSuspended({
          standsIn: self.coarseTierStandsIn,
          mode: self.coarseTierMode,
          gateRefusesDetail: self.gateRefusesDetail,
        })
      },
      /**
       * #getter
       * The foundation's phase with the too-large banner swapped for the tier
       * — see `coarseTierDisplayPhase`.
       */
      get displayPhase(): DisplayPhase {
        return coarseTierDisplayPhase(phaseHost(self))
      },
      /**
       * #getter
       * The export gate under the same swap — see `coarseTierSvgReady`.
       */
      get svgReady(): boolean {
        return coarseTierSvgReady(phaseHost(self))
      },
      /**
       * #getter
       * `renderDisplaySvg`'s hook: the export paints the tier in place of the
       * too-large note, the same swap the chrome makes on screen — unless the
       * note is about the coarse read itself.
       */
      get drawsWhenTooLarge() {
        return self.coarseTierStandsIn && !self.gateMeasuresCoarse
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setCoarseTier(entries: CoarseTierEntry<P>[], read: CoarseTierRead) {
        self.coarseTier.clear()
        for (const { displayedRegionIndex, payload } of entries) {
          self.coarseTier.set(displayedRegionIndex, payload)
        }
        self.coarseTierRead = read
      },
      /**
       * #action
       */
      clearCoarseTier() {
        self.coarseTier.clear()
        self.coarseTierRead = undefined
      },
      /**
       * #action
       */
      setCoarseTierLoading(loading: boolean) {
        self.coarseTierLoading = loading
      },
      /**
       * #action
       * Overridable hook (no-op base): the coarse read over `read.regions`,
       * answering one payload per region it covered or a refusal. `ctx` is the
       * skeleton's — its `callRpc` carries the stop token and the status slot,
       * and `isStale` guards any write the read makes for itself before it
       * returns.
       */
      fetchCoarseTier(
        _read: CoarseTierRead,
        _ctx: FetchContext,
      ): Promise<CoarseTierResult<P>> {
        return Promise.resolve({ entries: [] })
      },
    }))
    .actions(self => ({
      afterAttach() {
        onDisplayedRegionsChange(
          self,
          () => {
            self.clearCoarseTier()
          },
          'ClearCoarseTierOnNav',
        )
        installFetch<
          CoarseTierRead,
          { result: CoarseTierResult<P>; issued: GateFetchState | undefined }
        >(host(self), {
          name: 'FetchCoarseTier',
          delay: 300,
          report: { statusWindow: host(self).statusWindow },
          gate: () => self.coarseTierActive && !host(self).isMinimized,
          prepare: () => {
            const v = view(self)
            return v.initialized
              ? {
                  regions: v.bufferedVisibleRegions,
                  key: self.coarseTierIssueKey,
                }
              : undefined
          },
          heldAnswers: read => {
            const held = self.coarseTierRead
            return (
              held !== undefined &&
              held.key === read.key &&
              coarseTierCovers(held.regions, view(self).visibleRegions)
            )
          },
          run: async (read, ctx) => {
            const issued = self.coarseTierGated
              ? host(self).gateFetchState()
              : undefined
            return { result: await self.fetchCoarseTier(read, ctx), issued }
          },
          commit: ({ result, issued }, read) => {
            if (issued !== undefined) {
              host(self).commitFetchBytes([measuredBytes(result)], issued)
            }
            if (!isRegionRefused(result)) {
              self.setCoarseTier(result.entries, read)
            }
          },
          setError: error => {
            host(self).setError(error)
          },
          onBegin: () => {
            self.setCoarseTierLoading(true)
          },
          onEnd: current => {
            if (current) {
              self.setCoarseTierLoading(false)
            }
          },
        })
      },
    }))
}
