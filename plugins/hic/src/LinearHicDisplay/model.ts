import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
  computeRenderTransform,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import { contactLookupKey } from '../regionOffsets.ts'
import { generateColorRamp } from './components/colorRamp.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type { HicColorScheme } from './components/colorRamp.ts'
import type { HicRenderingBackend } from './components/hicRenderingBackendTypes.ts'
import type { HicTrackConfig } from './configSchema.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearHicDisplay
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

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearHicDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalDataDisplayMixin(),
      StaleViewportRescaleMixin(),
      ConfigOverrideMixin<HicTrackConfig, 'colorScheme' | 'showLegend'>([
        'colorScheme',
        'showLegend',
      ]),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearHicDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Signed integer offset from the zoom-derived auto-picked binsize.
         * `0` means pure auto. `-1` is one step finer than auto, `+1` is one
         * step coarser, etc. Tracking the *offset* (not an absolute binsize)
         * keeps the user's intent valid across zoom levels — a saved session
         * with bias=-1 still means "one step finer than auto" when reopened
         * at a different scale.
         */
        resolutionBias: types.stripDefault(types.number, 0),
        /**
         * #property
         * Map contact counts to color on a log2 scale instead of linear.
         */
        useLogScale: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Color saturation point: false → maxScore/20 (linear) or maxScore
         * (log), matches legacy behavior. true → 95th percentile of counts;
         * lower saturation point so off-diagonal contacts read more strongly.
         */
        useColorPercentile: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Whether the on-canvas resolution stepper overlay is shown. Toggled
         * from the track menu's `Show...` submenu; the stepper itself lives
         * only on the canvas to keep the menu uncluttered.
         */
        showResolutionControls: types.stripDefault(types.boolean, true),
        /**
         * #property
         * Active matrix normalization scheme (e.g. KR, SCALE, VC, NONE),
         * reconciled against what the `.hic` file actually provides.
         */
        activeNormalization: types.stripDefault(types.string, 'KR'),
        /**
         * #property
         * Squash the triangle vertically to fit the chosen display height
         * instead of drawing square bins at natural proportions.
         */
        fitToHeight: types.stripDefault(types.boolean, false),
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

    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      if (!snap) {
        return snap
      }
      // Drop any legacy `resolution` field — older snapshots stored either a
      // multiplier (< 1000) or an absolute binsize (>= 1000); neither maps
      // cleanly to the new `resolutionBias` field, so just reset to auto
      // (bias = 0) and let zoom drive the choice.
      //
      // The legacy `mode` enum became the `fitToHeight` boolean; only its
      // non-default 'adjust' value was ever serialized (stripDefault).
      const { resolution: _drop, mode, ...rest } = snap
      return mode === 'adjust' ? { ...rest, fitToHeight: true } : rest
    })
    .views(self => ({
      /**
       * #getter
       * GlobalDataDisplayMixin hook: the contact matrix has been fetched once
       * `rpcData` is set (the fetch commits it even for an empty viewport), so
       * `svgReady` waits for the debounced `afterAttach` fetch instead of
       * exporting an empty matrix.
       */
      get dataLoaded(): boolean {
        return self.rpcData !== null
      },
      get colorScheme(): HicColorScheme | undefined {
        return self.getOverride<HicColorScheme>('colorScheme')
      },
      get showLegend(): boolean | undefined {
        return self.getOverride<boolean>('showLegend')
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
        const view = getContainingView(self) as LinearGenomeViewModel
        const bpPerPx = Math.max(1, view.bpPerPx)
        let idx = -1
        for (let i = 0; i < avail.length; i++) {
          if (avail[i]! <= 2 * bpPerPx) {
            idx = i
          }
        }
        return idx === -1 ? 0 : idx
      },
      get yScalar() {
        // Squash (or stretch) the natural width/2 triangle into the dragged
        // display height. Matches the LD display's bidirectional fill — dragging
        // taller than the natural height fills the space rather than leaving a
        // blank band below.
        if (!self.fitToHeight) {
          return 1
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        const defaultHeight = view.totalWidthPx / 2
        return defaultHeight > 0 ? self.height / defaultHeight : 1
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
    }))
    .views(self => ({
      /**
       * #getter
       * The actual binsize to fetch at, after auto-pick + bias.
       */
      get effectiveResolution(): number | undefined {
        const avail = self.availableResolutions
        return avail?.length ? avail[self.effectiveResolutionIdx]! : undefined
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
       * #method
       * The binsize that `stepResolution(dir)` would land on, or undefined
       * if no valid step exists in that direction. Consumed by both the UI
       * (button disabled state) and `stepResolution` itself, so there's one
       * source of truth for "what's the next resolution".
       */
      nextResolution(dir: -1 | 1): number | undefined {
        const avail = self.availableResolutions
        if (!avail?.length) {
          return undefined
        }
        const next = self.effectiveResolutionIdx + dir
        return next >= 0 && next < avail.length ? avail[next] : undefined
      },

      /**
       * #getter
       * Forward transform { scale, viewOffsetX } shared by GPU render,
       * mouse hit-test, and SVG export. See `computeRenderTransform` for
       * the math.
       */
      get renderTransform() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return computeRenderTransform({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: view.offsetPx,
          viewBpPerPx: view.bpPerPx,
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
        // Bucket each axis into a region, then invert
        // positions[i] = (bin + regionCombinedOffsets[r]) * binWidth.
        const starts = data.regionDataXStarts
        const findRegion = (u: number) => {
          for (let i = starts.length - 2; i >= 0; i--) {
            if (u >= starts[i]!) {
              return i
            }
          }
          return 0
        }
        const r1 = findRegion(ux)
        const r2 = findRegion(uy)
        const bin1 = Math.floor(
          ux / data.binWidth - data.regionCombinedOffsets[r1]!,
        )
        const bin2 = Math.floor(
          uy / data.binWidth - data.regionCombinedOffsets[r2]!,
        )
        const idx = data.lookup[contactLookupKey(r1, r2, bin1, bin2)]
        if (idx === undefined) {
          return undefined
        }
        return {
          bin1,
          bin2,
          region1Idx: r1,
          region2Idx: r2,
          counts: data.counts[idx]!,
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * Computed per-frame render state for the GPU backend. Read by the
       * autorun lifecycle on every change to any tracked observable.
       */
      get renderState() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        const { scale, viewOffsetX } = self.renderTransform
        return {
          binWidth: data.binWidth,
          yScalar: self.yScalar,
          canvasWidth: view.totalWidthPx,
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
        return self.showLegend && self.colorMaxScore > 0 ? 140 : 0
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
        self.useLogScale = f
      },
      /**
       * #action
       */
      setUseColorPercentile(f: boolean) {
        self.useColorPercentile = f
      },
      /**
       * #action
       */
      setShowResolutionControls(f: boolean) {
        self.showResolutionControls = f
      },
      /**
       * #action
       */
      setColorScheme(f?: HicColorScheme) {
        self.setOverride('colorScheme', f)
      },
      /**
       * #action
       */
      setActiveNormalization(f: string) {
        self.activeNormalization = f
      },
      /**
       * #action
       * Reconcile `activeNormalization` against what the file actually offers.
       * The model seeds `activeNormalization='KR'` before `CoreGetInfo`
       * resolves, but not every `.hic` carries KR — when it doesn't, fall back
       * to the next-best available scheme so the UI selection matches what's
       * rendered (hic-straw silently uses NONE for an absent norm otherwise).
       */
      setAvailableNormalizations(f: string[]) {
        self.availableNormalizations = f
        if (!f.includes(self.activeNormalization)) {
          self.activeNormalization =
            ['KR', 'SCALE', 'VC_SQRT', 'VC'].find(n => f.includes(n)) ??
            f[0] ??
            'NONE'
        }
      },
      /**
       * #action
       */
      setFitToHeight(arg: boolean) {
        self.fitToHeight = arg
      },
      /**
       * #action
       */
      setShowLegend(arg: boolean) {
        self.setOverride('showLegend', arg)
      },
      /**
       * #action
       */
      setAvailableResolutions(f: number[]) {
        // Sort ascending (smallest binsize first) so index-based stepping is
        // consistent regardless of the order returned by hic-straw. This
        // makes "Finer" = idx-1 = smaller binsize and "Coarser" = idx+1 =
        // larger binsize.
        self.availableResolutions = [...f].sort((a, b) => a - b)
      },
      /**
       * #action
       * dir = -1 → finer (smaller binsize); dir = +1 → coarser. Re-grounds
       * the bias against the *current* effective index so repeated clicks
       * at a clamped boundary don't accumulate stale bias the user can't
       * see — the bias always reflects what's actually on screen.
       */
      stepResolution(dir: -1 | 1) {
        if (self.nextResolution(dir) === undefined) {
          return
        }
        self.resolutionBias =
          self.effectiveResolutionIdx + dir - self.autoResolutionIdx
      },
      /**
       * #action
       * Reset to pure auto-mode: bias 0, binsize follows zoom directly.
       */
      resetResolutionBias() {
        self.resolutionBias = 0
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
       * Re-fetches contact matrix for the current viewport. Both the
       * autorun (in `afterAttach`) and `reload()` invoke this directly.
       */
      async performHicFetch() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LinearGenomeViewModel
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

        addDisposer(
          self,
          autorun(
            () => {
              if (self.isMinimized) {
                return
              }
              const view = getContainingView(self) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              if (!view.dynamicBlocks.contentBlocks.length) {
                return
              }
              // effectiveResolution is undefined until availableResolutions
              // arrives from CoreGetInfo; reading it gates the fetch and tracks
              // resolution (bpPerPx + resolutionBias) so a zoom or step refires.
              if (self.effectiveResolution === undefined) {
                return
              }
              // Track user settings (normalization + any future rpcProps field)
              // so a settings change refires the fetch.
              void self.rpcProps()
              void self.reloadCounter
              void self.performHicFetch()
            },
            {
              delay: 1000,
              name: 'LinearHicDisplayRender',
            },
          ),
        )
      },
    }))
}

export type LinearHicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearHicDisplayModel = Instance<LinearHicDisplayStateModel>
