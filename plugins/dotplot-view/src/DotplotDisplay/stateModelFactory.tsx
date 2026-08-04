import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { sharedBackendKey } from '@jbrowse/render-core/keyedUploadSync'
import {
  SyntenyFetchStateMixin,
  getCoarseBpPerPxThreshold,
  isDataCurrent,
  resolveLodTier,
  swappedAssembliesWarning,
  syntenyFetchRegions,
} from '@jbrowse/synteny-core'

import { computeDotplotColors } from './dotplotColors.ts'
import { dotplotFetchKey } from './fetchKey.ts'
import { renderSvg } from './renderSvg.tsx'

import type {
  DotplotViewModel,
  ExportSvgOptions,
} from '../DotplotView/model.ts'
import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LodTier, SyntenyColorBy } from '@jbrowse/synteny-core'
import type { ThemeOptions } from '@mui/material'

/**
 * #stateModel DotplotDisplay
 * #category display
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'DotplotDisplay',
      BaseDisplay,
      SyntenyFetchStateMixin(),
      types
        .model({
          /**
           * #property
           */
          type: types.literal('DotplotDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          /**
           * #volatile
           * RPC-computed feature data
           */
          rpcData: undefined as DotplotRpcData | undefined,
          /**
           * #volatile
           * GPU-instance positions produced from rpcData, self-describing via
           * embedded bpPerPx, with no colors in them. Rebuilt only when the
           * data or the zoom changes; the palette is joined on top by the
           * `geometry` getter.
           */
          instanceData: undefined as DotplotInstanceData | undefined,
          fetchWarnings: [] as { message: string; effect: string }[],
        })),
    )
    .views(self => ({
      /**
       * #getter
       * Stable slot on the view-shared backend. Hashed from the node id, not
       * taken from the track's index, so hiding or reordering a sibling can't
       * hand this display another's buffer.
       */
      get displayKey() {
        return sharedBackendKey(self.id)
      },
      /**
       * #getter
       * A fetch has completed (data is present, even if it mapped zero
       * features). Not a feature-count test — an empty-but-finished fetch is
       * ready, otherwise an empty plot spins the loading overlay forever.
       */
      get ready() {
        return self.rpcData !== undefined
      },
      /**
       * #getter
       * Main-thread-computed per-segment colors — the gpuProps half of the
       * rpcProps/gpuProps split. A colorBy or alpha change recomputes this
       * alone, without re-walking a single CIGAR.
       */
      get computedColors() {
        const { instanceData, rpcData } = self
        return instanceData && rpcData
          ? computeDotplotColors({
              instanceData,
              rpcData,
              colorBy: this.colorBy,
              alpha: this.alpha,
              trackColor: this.trackColor,
            })
          : undefined
      },
      /**
       * #getter
       * Plot-wide opacity, owned by the view (see `DotplotView.alpha`). Read
       * through here rather than reaching for the view inside `computedColors`:
       * the annotated primitive keeps `DotplotViewModel` out of this model's own
       * inferred type, which a bare `view.alpha` in a getter body puts there —
       * and that cycle collapses the whole display model to `any` (same reason
       * renderSvg.tsx types its view structurally). `minAlignmentLength` needs
       * no such hop; its only reader is the geometry autorun, which is outside
       * the inference path and already holds the view.
       */
      get alpha(): number {
        return (getContainingView(self) as DotplotViewModel).alpha
      },
      /**
       * #getter
       * The mode this track renders with: its own override if the user set one,
       * else the plot-wide mode.
       */
      get colorBy(): SyntenyColorBy {
        const view = getContainingView(self) as DotplotViewModel
        return view.resolveColorBy(this.trackId)
      },
      /**
       * #getter
       * This track's slot in the plot's palette, used by `colorBy: 'track'`.
       * Assigned by the view, not locally: pinning a color on one track shifts
       * which automatic slots its siblings can take.
       */
      get trackColor(): string {
        const view = getContainingView(self) as DotplotViewModel
        return view.trackColorFor(this.trackId)
      },
      /**
       * #getter
       */
      get trackId(): string {
        return self.parentTrack.configuration.trackId
      },
      /**
       * #getter
       * Instance positions joined with the computed colors: what the backends
       * upload and what SVG export draws. The view's upload autorun reads this,
       * so a palette change re-uploads without rebuilding geometry.
       */
      get geometry() {
        const { instanceData } = self
        const colors = this.computedColors
        return instanceData && colors ? { ...instanceData, colors } : undefined
      },
      /**
       * #getter
       * First load: no data has arrived yet. Excludes error so error UI and
       * loading UI never show simultaneously. Drives the centered overlay.
       */
      get loading() {
        return !this.ready && !self.error
      },
      /**
       * #getter
       * Refetch in-flight: a new fetch is running but a stale plot is still on
       * screen (zoom, diagonalize reorder, pan past the buffer). Drives a
       * subtle corner indicator instead of the full overlay so the visible
       * plot isn't masked on every viewport change.
       */
      get refetching() {
        return self.fetching && this.ready && !self.error
      },
      /**
       * #getter
       * The h-axis fetch window: the visible content blocks expanded by the
       * shared pan buffer and snapped outward to a buffer-sized grid, so a pan
       * within the buffer neither refetches nor exposes an unfetched strip, and
       * zoomed out it collapses to the whole displayed region. The v axis is
       * deliberately not scoped: the fetch is one-dimensional (h regions in,
       * every mate out), so a vertical pan needs no data the h window didn't
       * already bring, and must never trigger a refetch.
       *
       * Unlike synteny, nothing culls this window again in the worker —
       * executeDotplotFeaturesAndPositions maps every feature it is handed — so
       * the window's only job is to be a superset of what's on screen.
       */
      get fetchRegions(): Region[] {
        const { hview } = getContainingView(self) as DotplotViewModel
        return syntenyFetchRegions({
          visibleRegions: hview.dynamicBlocks.contentBlocks.map(b => ({
            refName: b.refName,
            start: b.start,
            end: b.end,
            assemblyName: b.assemblyName,
            displayedRegionIndex: b.displayedRegionIndex!,
          })),
          displayedRegions: hview.displayedRegions,
          width: hview.width,
          bpPerPx: hview.bpPerPx,
        })
      },
      /**
       * #getter
       * The fetch-input signature (see fetchKey.ts) for the view's current
       * state. Reactive: recomputes when either axis's zoom or displayed-region
       * order/orientation changes, or when a pan carries the h axis into a new
       * snapped fetch window. As a computed it only notifies when the string
       * itself changes, which is what lets the fetch autorun track it and stay
       * quiet through sub-buffer pans.
       */
      get currentFetchKey(): string {
        const view = getContainingView(self) as DotplotViewModel
        return dotplotFetchKey(
          this.lodTier,
          {
            bpPerPx: view.hview.bpPerPx,
            regionSignature: view.hRegionSignature,
          },
          {
            bpPerPx: view.vview.bpPerPx,
            regionSignature: view.vRegionSignature,
          },
          this.fetchRegions,
        )
      },
      /**
       * #getter
       * The detail tier this plot's fetch asks the adapter for. Resolved here on
       * the main thread, not adapter-side from `bpPerPx`, so it is part of
       * `currentFetchKey` — see `resolveLodTier`. Both axes feed it: CIGAR detail
       * is worth drawing when a block is wide on either one, so dropping to the
       * no-CIGAR tier is only safe once both are past the threshold.
       */
      get lodTier(): LodTier {
        const view = getContainingView(self) as DotplotViewModel
        return resolveLodTier({
          bpPerPx: Math.min(view.hview.bpPerPx, view.vview.bpPerPx),
          coarseBpPerPxThreshold: getCoarseBpPerPxThreshold(self.parentTrack),
          lodMode: view.lodMode,
        })
      },
      /**
       * #getter
       * True when the rendered rpcData was fetched for the view's current
       * inputs. Goes false the instant a zoom or diagonalize reorder changes the
       * axes — before the debounced refetch begins and while stale geometry is
       * still on screen — so the `settled` done-gate can't fire on it. The
       * dotplot analog of LGV's `viewportWithinLoadedData`.
       */
      get dataCurrent(): boolean {
        return isDataCurrent(self.loadedFetchKey, this.currentFetchKey)
      },
      /**
       * #getter
       * Per-render fetch warnings, plus the load-time reversed-assembly hint.
       */
      get warnings() {
        return self.assembliesSwapped
          ? [
              ...self.fetchWarnings,
              swappedAssembliesWarning(
                'The chromosome names in the file match the opposite axis. Try switching the X and Y assemblies in the dotplot import form.',
              ),
            ]
          : self.fetchWarnings
      },
      /**
       * #getter
       * Off-screen SVG export gate: "Export SVG" waits on this before drawing
       * (see the [SVG export guide](/docs/developer_guides/svg_export)).
       * Runs the same shared `computeSvgReady` policy every other display does
       * and awaits it via the shared `awaitSvgReady` — no inlined `when()`. No
       * `regionTooLarge` state: the fetch is gated by LOD, not region size.
       * Stale-safe via `dataCurrent`: an export fired right after a
       * zoom/diagonalize reorder waits for geometry rebuilt from the fresh
       * fetch instead of exporting the stale plot.
       */
      get svgReady() {
        return computeSvgReady(
          {
            error: self.error,
            regionTooLarge: false,
            extraTerminal: false,
          },
          // instanceData, not geometry: this getter is read outside any
          // reactive context (the export await polls it), where reading the
          // `geometry` computed would recompute every segment's color per poll
          () => !!self.instanceData && this.dataCurrent,
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      renderSvg(opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        return renderSvg(self, opts)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRpcData(data: DotplotRpcData, fetchKey: string) {
        self.rpcData = data
        self.loadedFetchKey = fetchKey
        self.fetching = false
        self.statusMessage = undefined
        self.statusProgress = undefined
      },
      setWarnings(w: { message: string; effect: string }[]) {
        self.fetchWarnings = w
      },
      setInstanceData(data: DotplotInstanceData | undefined) {
        self.instanceData = data
      },
      /**
       * #action
       */
      setError(error: unknown) {
        // `setError(undefined)` is the clear-the-error path every fetch runs
        // through before it starts (installComparativeFetchAutorun), so logging
        // unconditionally printed a bare "undefined" to stderr on each
        // successful fetch — noise that a headless caller (jbrowse-img) reports
        // as if the render had a problem
        if (error !== undefined) {
          console.error(error)
        }
        self.error = error
        self.fetching = false
        self.statusMessage = undefined
        self.statusProgress = undefined
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type DotplotDisplayModel = Instance<ReturnType<typeof stateModelFactory>>
