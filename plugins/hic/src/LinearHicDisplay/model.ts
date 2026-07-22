import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { GRADIENT_LEGEND_SVG_AREA_WIDTH } from '@jbrowse/core/ui'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
  computeRenderTransform,
  computeTriangleYScalar,
  installGlobalFetchAutorun,
  viewportMatchesLastDrawn,
} from '@jbrowse/plugin-linear-genome-view'

import { generateColorRamp } from './components/colorRamp.ts'
import { findContactAt } from './contactLookup.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type { HicColorScheme } from './components/colorRamp.ts'
import type { HicRenderingBackend } from './components/hicRenderingBackendTypes.ts'
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
       * The normalization actually used, resolved against what the file offers
       * (`availableNormalizations`). Falls back to the next-best available scheme
       * when the selection is absent (hic-straw silently uses NONE otherwise).
       * A pure getter, so opening a file that lacks the selected scheme never
       * writes a config delta / marks the track edited — only an explicit user
       * pick (setActiveNormalization) does.
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
      get fitToHeight(): boolean {
        return getConf(self, 'fitToHeight')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * GlobalDataDisplayMixin hook (global-display analog of
       * `viewportWithinLoadedData`): the contact matrix is loaded once
       * `rpcData` is set (the fetch commits it even for an empty viewport) AND
       * that data was fetched for the current viewport. Gating on freshness —
       * not merely `rpcData !== null` — keeps off-screen `svgReady` from
       * resolving on a matrix left over from the pre-pan/zoom viewport during
       * the debounced-refetch window (`setLastDrawnViewport` runs right after
       * `setRpcData`, so the two move together).
       */
      get dataLoaded(): boolean {
        return (
          self.rpcData !== null &&
          viewportMatchesLastDrawn({
            lastDrawnOffsetPx: self.lastDrawnOffsetPx,
            lastDrawnBpPerPx: self.lastDrawnBpPerPx,
            viewOffsetPx: self.view.offsetPx,
            viewBpPerPx: self.view.bpPerPx,
          })
        )
      },
      /**
       * #getter
       * Data has arrived for the current viewport and it is genuinely empty —
       * the file has no contacts here at this resolution (HicAdapter returns
       * `[]` for such a region pair). Lets the UI tell "nothing to show" apart
       * from "still fetching", which otherwise look identical: a blank track.
       */
      get isEmpty(): boolean {
        return this.dataLoaded && self.rpcData?.numContacts === 0
      },
      get colorScheme(): HicColorScheme {
        return getConf(self, 'colorScheme')
      },
      get showLegend(): boolean {
        return getConf(self, 'showLegend')
      },
      get colorMaxScore() {
        const data = self.rpcData
        if (!data) {
          return 0
        }
        if (self.useColorPercentile) {
          return data.percentile95
        }
        return self.useLogScale ? data.maxScore : data.maxScore / 20
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
        let idx = -1
        for (let i = 0; i < avail.length; i++) {
          if (avail[i]! <= 2 * bpPerPx) {
            idx = i
          }
        }
        return idx === -1 ? 0 : idx
      },
      get yScalar() {
        // Bidirectional fill like the LD display: dragging taller than the
        // natural triangle height stretches to fill rather than leaving a
        // blank band below.
        return computeTriangleYScalar({
          fitToHeight: self.fitToHeight,
          displayHeight: self.height,
          triangleWidth: self.view.totalWidthPx,
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

      /**
       * #getter
       * Forward transform { scale, viewOffsetX } shared by GPU render,
       * mouse hit-test, and SVG export. See `computeRenderTransform` for
       * the math.
       */
      get renderTransform() {
        return computeRenderTransform({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: self.view.offsetPx,
          viewBpPerPx: self.view.bpPerPx,
        })
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
       * autorun lifecycle on every change to any tracked observable.
       */
      get renderState() {
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        const { scale, viewOffsetX } = self.renderTransform
        return {
          binWidth: data.binWidth,
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
       * when no legend will be drawn so the export framework can omit space.
       */
      svgLegendWidth(): number {
        return self.showLegend && self.hasLegendData
          ? GRADIENT_LEGEND_SVG_AREA_WIDTH
          : 0
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRpcData(data: HicDataResult | null) {
        self.rpcData = data
      },
      /**
       * #action
       * Called by the React hook (`useRenderingBackend`) when the HAL
       * resolves. Wires the backend into the mixin-owned autorun pair via
       * `attachRenderingBackend`.
       */
      startRenderingBackend(backend: HicRenderingBackend) {
        self.attachRenderingBackend<HicRenderingBackend>(backend, {
          upload: b => {
            if (self.rpcData) {
              b.uploadData(self.rpcData)
            }
            b.uploadColorRamp(generateColorRamp(self.colorScheme))
          },
          render: b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            b.render(self.rpcData, state)
            return true
          },
        })
      },
      /**
       * #action
       */
      setUseLogScale(f: boolean) {
        self.configuration.setSlot('useLogScale', f)
      },
      /**
       * #action
       */
      setUseColorPercentile(f: boolean) {
        self.configuration.setSlot('useColorPercentile', f)
      },
      /**
       * #action
       */
      setShowResolutionControls(f: boolean) {
        self.configuration.setSlot('showResolutionControls', f)
      },
      /**
       * #action
       */
      setColorScheme(f?: HicColorScheme) {
        self.configuration.setSlot('colorScheme', f)
      },
      /**
       * #action
       * Persist the user's explicit normalization pick. Resolution against what
       * the file offers happens in the `activeNormalization` getter, so this
       * only fires on a real user choice.
       */
      setActiveNormalization(f: string) {
        self.configuration.setSlot('selectedNormalization', f)
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
      setFitToHeight(arg: boolean) {
        self.configuration.setSlot('fitToHeight', arg)
      },
      /**
       * #action
       */
      setShowLegend(arg: boolean) {
        self.configuration.setSlot('showLegend', arg)
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
        self.configuration.setSlot('resolutionBias', 0)
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
          self.configuration.setSlot(
            'resolutionBias',
            idx - self.autoResolutionIdx,
          )
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
        const regions = view.dynamicBlocks.contentBlocks
        if (!regions.length) {
          return
        }
        const resolution = self.effectiveResolution
        if (resolution === undefined) {
          return
        }
        const { bpPerPx } = view
        const { adapterConfig } = self
        await self.runFetch(async ctx => {
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          const result = await rpcManager.call(
            sessionId,
            'RenderHicData',
            {
              adapterConfig,
              regions: [...regions],
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
          self.setLastDrawnViewport(view.offsetPx, view.bpPerPx)
        })
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
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
            console.error(e)
            if (isAlive(self)) {
              getSession(self).notifyError(`${e}`, e)
            }
          }
        })()

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
