import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { GRADIENT_LEGEND_SVG_AREA_WIDTH } from '@jbrowse/core/ui'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
  computeTriangleYScalar,
  installGlobalFetchAutorun,
} from '@jbrowse/plugin-linear-genome-view'
import { createGlobalUploadSync } from '@jbrowse/render-core/globalUploadSync'
import { autorun } from 'mobx'

import { calcRegionScreenOffsetsPx } from '../regionOffsets.ts'
import { generateColorRamp } from './components/colorRamp.ts'
import { findContactAt } from './contactLookup.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type { HicColorScheme } from './components/colorRamp.ts'
import type {
  HicRenderState,
  HicRenderingBackend,
} from './components/hicRenderingBackendTypes.ts'
import type { HicTrackConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

/**
 * #stateModel LinearHicDisplay
 * #displayFoundation GlobalDataDisplayMixin
 * #category display
 * Hi-C display that renders contact matrix using WebGL
 *
 * #example
 * A complete `HicTrack` config to paste into `tracks`. `resolutionBias` nudges
 * the auto-picked binsize (negative = finer, positive = coarser):
 * ```js
 * {
 *   type: 'HicTrack',
 *   trackId: 'hic',
 *   name: 'Hi-C',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
 *   displays: [
 *     {
 *       type: 'LinearHicDisplay',
 *       displayId: 'hic-LinearHicDisplay',
 *       useLogScale: true,
 *       resolutionBias: 1,
 *     },
 *   ],
 * }
 * ```
 */

export default function stateModelFactory(configSchema: HicTrackConfigModel) {
  return types
    .compose(
      'LinearHicDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalDataDisplayMixin(),
      StaleViewportRescaleMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearHicDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as HicDataResult | null,
      /**
       * #volatile
       */
      availableNormalizations: undefined as string[] | undefined,
      /**
       * #volatile
       */
      availableResolutions: undefined as number[] | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * the containing LGV, typed once here so downstream getters don't repeat
       * the `getContainingView` cast
       */
      get view(): LinearGenomeViewModel {
        return getContainingView(self) as LinearGenomeViewModel
      },
      /**
       * #getter
       */
      get resolutionBias(): number {
        return getConf(self, 'resolutionBias')
      },
      /**
       * #getter
       * Whether the `.hic` file's binsize list has arrived (it comes from the
       * async CoreGetInfo call in afterAttach). Every resolution control — the
       * track-menu stepper, the on-figure dropdown and its enabling checkbox —
       * is gated on this rather than re-deriving `availableResolutions?.length`.
       */
      get hasResolutions(): boolean {
        return !!self.availableResolutions?.length
      },
      /**
       * #getter
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST getter named after config slot
      get useLogScale(): boolean {
        return getConf(self, 'useLogScale')
      },
      /**
       * #getter
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST getter named after config slot
      get useColorPercentile(): boolean {
        return getConf(self, 'useColorPercentile')
      },
      /**
       * #getter
       */
      get showResolutionControls(): boolean {
        return getConf(self, 'showResolutionControls')
      },
      /**
       * #getter
       * The user's persisted normalization choice. May name a scheme the current
       * `.hic` file doesn't actually offer — `activeNormalization` resolves that.
       */
      get selectedNormalization(): string {
        return getConf(self, 'selectedNormalization')
      },
      /**
       * #getter
       * The normalization to *request*, resolved against what the file offers
       * (`availableNormalizations`). Falls back to the next-best available scheme
       * when the selection is absent (hic-straw silently uses NONE otherwise).
       * A pure getter, so opening a file that lacks the selected scheme never
       * writes a config delta / marks the track edited — only an explicit user
       * pick (setActiveNormalization) does.
       *
       * What the file could *deliver* is a second question this can't answer:
       * normalization vectors are stored per (type, chr, unit, binsize) and
       * `availableNormalizations` is the file-wide union, so a scheme listed here
       * can still be missing at the current binsize. `appliedNormalization` below
       * carries what actually came back.
       */
      get activeNormalization(): string {
        const avail = self.availableNormalizations
        const selected = this.selectedNormalization
        if (!avail || avail.includes(selected)) {
          return selected
        }
        return (
          ['KR', 'SCALE', 'VC_SQRT', 'VC'].find(n => avail.includes(n)) ??
          avail[0] ??
          'NONE'
        )
      },
      /**
       * #getter
       */
      get squashToHeight(): boolean {
        return getConf(self, 'squashToHeight')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The shared freshness hook, HiC's way: the contact matrix is current once
       * `rpcData` is set (the fetch commits it even for an empty viewport) AND
       * that data was fetched for the current viewport. Gating on freshness —
       * not merely `rpcData !== null` — keeps off-screen `svgReady` from
       * resolving on a matrix left over from the pre-pan/zoom viewport during
       * the debounced-refetch window (`setLastDrawnViewport` runs right after
       * `setRpcData`, so the two move together).
       */
      get dataCurrent(): boolean {
        return self.rpcData !== null && self.viewportFresh
      },
      /**
       * #getter
       * The normalization the loaded matrix actually carries, which differs from
       * `activeNormalization` whenever the file has no vectors for the requested
       * scheme at the current binsize (KR at 5 kb but nothing at 2.5 Mb is
       * typical). The track menu ticks this, so the radios describe the data on
       * screen rather than the request that produced it. Falls back to the
       * request before any data has landed.
       *
       * Read only by the UI. It is fetch-derived, so it must stay out of
       * `rpcProps()` — see the "rpcProps() loop trap".
       */
      get appliedNormalization(): string {
        return self.rpcData?.appliedNormalization ?? self.activeNormalization
      },
      get colorScheme(): HicColorScheme {
        return getConf(self, 'colorScheme')
      },
      get showLegend(): boolean {
        return getConf(self, 'showLegend')
      },
      get colorMaxScore() {
        const data = self.rpcData
        return data
          ? self.useColorPercentile
            ? data.percentile95
            : self.useLogScale
              ? data.maxScore
              : data.maxScore / 20
          : 0
      },
      /**
       * #getter
       * Whether there's a color scale worth drawing a legend for: data loaded
       * with a positive saturation point. The single place the `colorMaxScore`
       * "0 means nothing to show" sentinel is interpreted — legend consumers
       * read this, not the raw score.
       */
      get hasLegendData(): boolean {
        return this.colorMaxScore > 0
      },
      /**
       * #getter
       * Index into `availableResolutions` that pure auto-mode would pick at
       * the current zoom — largest binsize ≤ 2*bpPerPx, falling back to the
       * finest binsize (idx 0) when nothing qualifies (very zoomed in).
       *
       * The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins
       * visible without going sub-pixel; users who want finer can step the
       * resolution bias down.
       */
      get autoResolutionIdx(): number {
        const avail = self.availableResolutions
        if (!avail?.length) {
          return -1
        }
        const bpPerPx = Math.max(1, self.view.bpPerPx)
        // sorted ascending by setAvailableResolutions, so the last match is the
        // largest qualifying binsize
        const idx = avail.findLastIndex(binSize => binSize <= 2 * bpPerPx)
        return idx === -1 ? 0 : idx
      },
      /**
       * #getter
       * Vertical squash of the triangle. Bidirectional fill like the LD display:
       * dragging taller than the natural triangle height stretches to fill
       * rather than leaving a blank band below.
       *
       * WithoutBorders, because the base is the *content* the worker packed
       * (`regionOffsets` lays contentBlocks out contiguously). `totalWidthPx`
       * also counts the boundary padding blocks dynamicBlocks adds when
       * scrolled left of genome start / past the end, which would overstate the
       * base and leave fit-to-height short of the display.
       */
      get yScalar() {
        return computeTriangleYScalar({
          squashToHeight: self.squashToHeight,
          displayHeight: self.height,
          triangleWidth: self.view.totalWidthPxWithoutBorders,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Index actually used after applying `resolutionBias`, clamped to the
       * valid range so a stale bias from a different zoom level can't index
       * out of bounds.
       */
      get effectiveResolutionIdx(): number {
        const avail = self.availableResolutions
        if (!avail?.length) {
          return -1
        }
        return Math.max(
          0,
          Math.min(
            avail.length - 1,
            self.autoResolutionIdx + self.resolutionBias,
          ),
        )
      },
      /**
       * #getter
       * The actual binsize to fetch at, after auto-pick + bias.
       */
      get effectiveResolution(): number | undefined {
        const avail = self.availableResolutions
        return avail?.length ? avail[this.effectiveResolutionIdx]! : undefined
      },
      /**
       * #getter
       * Whether a finer binsize exists to step to. The stepper controls read
       * this rather than compare indices themselves, so the edges of the file's
       * binsize list are described in one place.
       */
      get canStepResolutionFiner(): boolean {
        return this.effectiveResolutionIdx > 0
      },
      /**
       * #getter
       * Whether a coarser binsize exists to step to.
       */
      get canStepResolutionCoarser(): boolean {
        const avail = self.availableResolutions
        return (
          avail !== undefined && this.effectiveResolutionIdx < avail.length - 1
        )
      },
    }))
    .views(self => ({
      // User-controlled settings that drive a refetch: spread into the RPC
      // payload via `...self.rpcProps()` and read once by the afterAttach
      // autorun for dependency tracking, so any field added here flows into
      // both. `resolution` is deliberately NOT here — it's zoom-derived (a
      // function of bpPerPx + resolutionBias), so it's an explicit per-call
      // arg alongside bpPerPx, not a user setting. See ARCHITECTURE.md
      // "rpcProps()/gpuProps() pattern".
      rpcProps(): { normalization: string } {
        return { normalization: self.activeNormalization }
      },
    }))
    .views(self => ({
      /**
       * #method
       * Inverse of the render transform: takes mouse coords (canvas-relative)
       * and returns the contact bin under the cursor, or undefined. The
       * forward transform lives in `renderTransform`; this is its inverse so
       * hit-testing always matches what was drawn.
       */
      hitTest(mouseX: number, mouseY: number): HicContactItem | undefined {
        const data = self.rpcData
        if (!data || data.numContacts === 0) {
          return undefined
        }
        const { scale, viewOffsetX } = self.renderTransform
        // Reverse viewport transform, then un-rotate to pre-rotation
        // data-space — the same coordinate system positions[] live in.
        const dataX = (mouseX - viewOffsetX) / scale
        const dataY = mouseY / scale / self.yScalar
        const ux = (dataX - dataY) / Math.SQRT2
        const uy = (dataX + dataY) / Math.SQRT2
        return findContactAt(data, ux, uy)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Computed per-frame render state for the GPU backend. Read by the
       * autorun lifecycle on every change to any tracked observable. Always
       * resolved (a bare getter must never hand back undefined) — it's pure
       * view/settings geometry, and "no data yet" is the render callback's gate,
       * not a nullable state. The one data-derived field, `binWidth`, rides with
       * the payload instead (see HicUploadData).
       */
      get renderState(): HicRenderState {
        const { scale, viewOffsetX } = self.renderTransform
        return {
          yScalar: self.yScalar,
          canvasWidth: self.view.totalWidthPx,
          canvasHeight: self.height,
          colorMaxScore: self.colorMaxScore,
          useLogScale: self.useLogScale,
          viewScale: scale,
          viewOffsetX,
        }
      },

      /**
       * #method
       * Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0
       * when the legend is off so the export framework can omit the space.
       *
       * Deliberately NOT gated on `hasLegendData` too: SVGLinearGenomeView maxes
       * this across tracks *before* awaiting each `renderSvg`, so on a headless
       * export (jbrowse-img — the fetch is a debounced autorun) the data hasn't
       * landed yet and a data-dependent answer reserved nothing, leaving the
       * legend to float over the matrix. Reserving on the setting alone costs an
       * unused strip only when the track loads empty or errors.
       */
      svgLegendWidth(): number {
        return self.showLegend ? GRADIENT_LEGEND_SVG_AREA_WIDTH : 0
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRpcData(data: HicDataResult) {
        self.rpcData = data
      },
      /**
       * #action
       * Called by the React hook (`useRenderingBackend`) when the HAL
       * resolves. Wires the backend into the mixin-owned autorun pair via
       * `attachRenderingBackend`.
       */
      startRenderingBackend(backend: HicRenderingBackend) {
        // The matrix and the palette have independent inputs (RPC result vs
        // config slot) but share the one mixin-owned upload autorun, so without
        // per-slot diffing a palette flip re-pushed the whole contact matrix and
        // a new fetch rebuilt the ramp texture. Both inputs stay read
        // unconditionally so neither drops out of the autorun's dependency set.
        const syncUpload = createGlobalUploadSync<HicRenderingBackend>()
        self.attachRenderingBackend<HicRenderingBackend>(backend, {
          upload: b => {
            syncUpload(b, 'data', self.rpcData, (bb, data) => {
              if (data) {
                bb.uploadData(data)
              }
            })
            syncUpload(b, 'colorRamp', self.colorScheme, (bb, colorScheme) => {
              bb.uploadColorRamp(generateColorRamp(colorScheme))
            })
          },
          render: b => {
            const data = self.rpcData
            if (!data) {
              return false
            }
            b.render(data, self.renderState)
            return true
          },
        })
      },
      /**
       * #action
       */
      setUseLogScale(f: boolean) {
        setConf(self, 'useLogScale', f)
      },
      /**
       * #action
       */
      setUseColorPercentile(f: boolean) {
        setConf(self, 'useColorPercentile', f)
      },
      /**
       * #action
       */
      setShowResolutionControls(f: boolean) {
        setConf(self, 'showResolutionControls', f)
      },
      /**
       * #action
       */
      setColorScheme(f: HicColorScheme) {
        setConf(self, 'colorScheme', f)
      },
      /**
       * #action
       * Persist the user's explicit normalization pick. Resolution against what
       * the file offers happens in the `activeNormalization` getter, so this
       * only fires on a real user choice.
       */
      setActiveNormalization(f: string) {
        setConf(self, 'selectedNormalization', f)
      },
      /**
       * #action
       * Record what the `.hic` file offers. Resolution lives in the
       * `activeNormalization` getter (which falls back off this list when the
       * user's `selectedNormalization` isn't available), so this doesn't write
       * the selection — opening a file that lacks the selected scheme never
       * marks the track edited.
       */
      setAvailableNormalizations(f: string[]) {
        self.availableNormalizations = f
      },
      /**
       * #action
       */
      setSquashToHeight(arg: boolean) {
        setConf(self, 'squashToHeight', arg)
      },
      /**
       * #action
       */
      setShowLegend(arg: boolean) {
        setConf(self, 'showLegend', arg)
      },
      /**
       * #action
       */
      setAvailableResolutions(f: number[]) {
        // Sort ascending (smallest binsize first) regardless of the order
        // hic-straw returns, so `resolutionBias` arithmetic is consistent: a
        // negative bias is always finer, a positive one always coarser.
        self.availableResolutions = [...f].sort((a, b) => a - b)
      },
      /**
       * #action
       * Reset to pure auto-mode: bias 0, binsize follows zoom directly.
       */
      resetResolutionBias() {
        setConf(self, 'resolutionBias', 0)
      },
      /**
       * #action
       * Lock to a specific binsize (from the overlay dropdown) by converting it
       * to the bias offset from the current auto pick, so the choice still
       * shifts consistently as the user zooms. No-op if the binsize isn't one
       * the file offers.
       */
      setResolution(binSize: number) {
        const avail = self.availableResolutions
        const idx = avail ? avail.indexOf(binSize) : -1
        if (idx !== -1) {
          setConf(self, 'resolutionBias', idx - self.autoResolutionIdx)
        }
      },
      /**
       * #action
       * Step one entry finer (negative delta) or coarser (positive) from the
       * binsize currently in effect, again as a bias off the auto pick. Clamped
       * to what the file offers, so a step at either edge no-ops instead of
       * indexing out of bounds — the menu's stepper disables there, and this
       * keeps that from being the only thing standing between a bad index and
       * a fetch.
       */
      stepResolution(delta: number) {
        const avail = self.availableResolutions
        if (avail?.length) {
          const idx = Math.max(
            0,
            Math.min(avail.length - 1, self.effectiveResolutionIdx + delta),
          )
          setConf(self, 'resolutionBias', idx - self.autoResolutionIdx)
        }
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [...superTrackMenuItems(), ...buildHicTrackMenuItems(self)]
        },

        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearHicDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Re-fetches contact matrix for the current viewport. Driven by the
       * `afterAttach` autorun, which also re-fires on `reload()` (it tracks
       * `reloadCounter`).
       */
      async performHicFetch() {
        if (self.isMinimized) {
          return
        }
        const view = self.view
        if (!view.initialized) {
          return
        }
        const contentBlocks = view.dynamicBlocks.contentBlocks
        if (!contentBlocks.length) {
          return
        }
        const resolution = self.effectiveResolution
        if (resolution === undefined) {
          return
        }
        // Capture the viewport this fetch is issued for. `setLastDrawnViewport`
        // below must record *these* values, not a live re-read: `ctx.isStale()`
        // only trips on a newer fetch or a cancel, so a pan/zoom during the RPC
        // would otherwise stamp the new viewport onto a matrix packed for the
        // old one — `renderTransform` would then read scale 1 and leave the
        // stale pixels un-rescaled, and the freshness getter below (and so
        // `svgReady`) would call them current.
        const { bpPerPx, offsetPx } = view
        const { adapterConfig } = self
        // Read the layout's own offsets here, alongside the viewport capture:
        // the worker can't re-derive them from region widths, because
        // `contentBlocks` omits elided regions that still take up screen space.
        const regionOffsetsPx = calcRegionScreenOffsetsPx(
          contentBlocks,
          offsetPx,
        )
        await self.runFetch(async ctx => {
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          const result = await rpcManager.call(
            sessionId,
            'RenderHicData',
            {
              adapterConfig,
              regions: [...contentBlocks],
              regionOffsetsPx,
              bpPerPx,
              resolution,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
            },
            {
              statusCallback: self.makeStatusCallback(),
            },
          )
          if (ctx.isStale()) {
            return
          }
          self.setRpcData(result)
          self.setLastDrawnViewport(offsetPx, bpPerPx)
        })
      },
      /**
       * #action
       * One-shot header read: the file's normalization and binsize lists. Every
       * contact fetch is gated on it (`shouldFetch` requires
       * `effectiveResolution`, which only exists once `availableResolutions`
       * lands), so a failure here is terminal for this display, not a
       * degradation — hence `setError` rather than a session snackbar. Without
       * it the display sat on the loading scrim forever with nothing said, and
       * `svgReady` (which resolves on `error`) never settled, hanging the whole
       * view's SVG export on an unbounded `awaitSvgReady`.
       */
      async fetchHicInfo() {
        try {
          const { rpcManager } = getSession(self)
          const rpcSessionId = getRpcSessionId(self)
          const { norms, resolutions } = (await rpcManager.call(
            rpcSessionId,
            'CoreGetInfo',
            { adapterConfig: self.adapterConfig },
          )) as { norms?: string[]; resolutions?: number[] }
          if (isAlive(self)) {
            if (norms) {
              self.setAvailableNormalizations(norms)
            }
            if (resolutions) {
              self.setAvailableResolutions(resolutions)
              // No initial selection needed — `effectiveResolution` derives
              // the binsize from bpPerPx + `resolutionBias` on every fetch.
            }
          }
        } catch (e) {
          // setError surfaces this in the display chrome with a retry, so
          // logging it too would just double-report
          if (isAlive(self)) {
            self.setError(e)
          }
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // Tracks `reloadCounter` so the chrome's retry button re-reads the
        // header too: `reload()` clears `error`, and without a re-read the
        // display would drop straight back onto the permanent scrim.
        addDisposer(
          self,
          autorun(
            () => {
              void self.reloadCounter
              // errors are captured in setError; fire-and-forget is safe
              void self.fetchHicInfo()
            },
            { name: 'LinearHicDisplayInfo' },
          ),
        )

        installGlobalFetchAutorun(self, {
          // effectiveResolution is undefined until availableResolutions arrives
          // from CoreGetInfo; reading it gates the fetch and tracks resolution
          // (bpPerPx + resolutionBias) so a zoom or step refires. The helper
          // tracks rpcProps() (normalization) + reloadCounter for us.
          shouldFetch: () => self.effectiveResolution !== undefined,
          fetch: () => {
            void self.performHicFetch()
          },
          delay: 1000,
          name: 'LinearHicDisplayRender',
        })
      },
    }))
}

export type LinearHicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearHicDisplayModel = Instance<LinearHicDisplayStateModel>
