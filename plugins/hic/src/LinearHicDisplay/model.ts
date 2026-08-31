import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getContainingView } from '@jbrowse/core/util'
import GlobalFetchMixin, {
  blockKeySignature,
} from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin, {
  gradientSvgLegendWidth,
} from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { installPrerequisiteFetch } from '@jbrowse/display-kit/installPrerequisiteFetch'
import { triangleScreenToData } from '@jbrowse/display-kit/triangleTransform'
import { computeTriangleYScalar } from '@jbrowse/display-kit/triangleYScalar'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'

import { calcAxisBlocks } from '../regionOffsets.ts'
import { generateColorRamp } from './components/colorRamp.ts'
import { findContactAt } from './contactLookup.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type { HicColorScheme } from './components/colorRamp.ts'
import type {
  HicCellKey,
  HicRenderState,
  HicRenderingBackend,
} from './components/hicRenderingBackendTypes.ts'
import type { HicTrackConfigModel } from './configSchema.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

/**
 * #stateModel LinearHicDisplay
 * #displayFoundation GlobalFetchMixin
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
      GlobalFetchMixin(),
      LegendMixin(),
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
      get view() {
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
       * Retry here is two-stage: `reload()` wakes the info autorun and the
       * contacts one, the contacts one runs first and declines because the
       * header it needs has not landed, and the header arriving wakes it again
       * through the same tracked read. So the retry contract is judged on that
       * later run. Not `fetchInert`, which would be the wrong claim —
       * HiC does want the scrim meanwhile.
       *
       * This is the header not having landed, which is also exactly when
       * `prepare` declines: HiC's gate and its prerequisite are one
       * condition, so every decline defers and the check can never report on
       * this display. Deliberate, and the cost is that `infoFetchFailure.test.ts`
       * is what pins HiC's retry. See `FetchMixin.awaitingPrerequisite`.
       */
      get awaitingPrerequisite(): boolean {
        return !this.hasResolutions
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
       * when the selection is absent (the parser silently uses NONE otherwise).
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
      /**
       * #getter
       * Where the color ramp saturates. `0` is the "no data to scale against"
       * sentinel; `hasLegendData` is the one place it's interpreted.
       *
       * The linear branch saturates at a twentieth of the max rather than the
       * max itself. Contact counts are heavily skewed — a handful of very hot
       * bins near the diagonal against a long tail near zero (see
       * `countStats.ts`) — so scaling to the true max leaves everything
       * off-diagonal at the bottom of the ramp. Log scale needs no such
       * correction, and `useColorPercentile` is the principled version of the
       * same fix.
       */
      get colorMaxScore(): number {
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
       * Whether a legend is drawn: the setting is on AND there is a scale worth
       * drawing one for. Read by both the on-screen overlay panel and the SVG
       * export, so an export can't disagree with the figure it is exporting.
       * `svgLegendWidth()` deliberately does not gate on this — see its note.
       */
      get showLegendArea(): boolean {
        return self.showLegend && this.hasLegendData
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
        const bpPerPx = Math.max(1, self.host.bpPerPx)
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
       * WithoutBorders, because the base is the axis the *content* occupies —
       * the span the worker can put contacts on. `totalWidthPx` also counts the
       * boundary padding blocks dynamicBlocks adds when scrolled left of genome
       * start / past the end, which carry no data, so including them would
       * overstate the base and leave fit-to-height short of the display.
       */
      get yScalar() {
        return computeTriangleYScalar({
          squashToHeight: self.squashToHeight,
          displayHeight: self.height,
          triangleWidth: self.view.totalWidthPxWithoutBorders,
        })
      },
      /**
       * #getter
       * The box the matrix is drawn in: the canvas element's CSS width and the
       * backing store the rendering backends resize to (`renderState`) have to
       * be one number, or the drawn matrix is stretched against the box it sits
       * in. Same name and same reason as the LD display's.
       *
       * `totalWidthPx` here and `totalWidthPxWithoutBorders` for the triangle's
       * base above, which is the whole difference between the two: the canvas
       * covers the scrolled content including the boundary padding blocks, and
       * the apex height is set by the span the worker can put contacts on. They
       * agree except when scrolled past an end.
       */
      get canvasWidth() {
        return self.host.totalWidthPx
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
      /**
       * #getter
       * HiC's half of `GlobalFetchMixin`'s freshness compare: the static-block
       * set plus the binsize the current zoom calls for, so a pan inside the
       * loaded blocks is a pure redraw and only a real change — a block
       * entering, a zoom (static blocks re-snap, and the binsize may step) —
       * refetches. Undefined until the view is measured and the `.hic` header
       * has landed, which is the prerequisite gate. The normalization axis
       * rides in through the `rpcPropsCacheKey` half the mixin appends.
       *
       * `activeNormalization` reading the fetched header list is safe for the
       * reason ARCHITECTURE.md's loop-trap section gives: the contact fetch
       * this signature keys never writes `availableNormalizations`, so a
       * mismatch converges in one fetch.
       */
      get viewSignature(): string | undefined {
        const { host } = self
        const resolution = self.effectiveResolution
        return host.initialized && resolution !== undefined
          ? `${blockKeySignature(host.staticBlocks.contentBlocks)}|res:${resolution}`
          : undefined
      },
      /**
       * #getter
       * The per-frame map from the payload's pre-rotation data space
       * (origin-relative axis bp / √2) to canvas px, read by the render state,
       * the hit test and the SVG export so the three cannot disagree. Worker
       * output is genomic, so this is pure live-view arithmetic — pan and zoom
       * move it every frame with no refetch — and the one payload-derived term,
       * `originBp`, folds the axis origin back in here, in double precision,
       * which is what keeps float32 instance positions small (see
       * `calcAxisBlocks`). Stale data during a refetch simply draws at its own
       * genomic position under the live map.
       */
      get viewTransform() {
        const { bpPerPx, offsetPx } = self.host
        const originBp = self.rpcData?.originBp ?? 0
        return {
          viewScale: 1 / bpPerPx,
          viewOffsetX: originBp / bpPerPx - offsetPx,
        }
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
       * Inverse of the view transform: takes mouse coords (canvas-relative)
       * and returns the contact bin under the cursor, or undefined. The
       * forward transform is `viewTransform`; this is its inverse so
       * hit-testing always matches what was drawn.
       */
      hitTest(mouseX: number, mouseY: number): HicContactItem | undefined {
        const data = self.rpcData
        if (!data || data.numContacts === 0) {
          return undefined
        }
        const { ux, uy } = triangleScreenToData(mouseX, mouseY, {
          ...self.viewTransform,
          yScalar: self.yScalar,
          yOffsetPx: 0,
        })
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
        const { viewScale, viewOffsetX } = self.viewTransform
        return {
          yScalar: self.yScalar,
          canvasWidth: self.canvasWidth,
          canvasHeight: self.height,
          colorMaxScore: self.colorMaxScore,
          useLogScale: self.useLogScale,
          viewScale,
          viewOffsetX,
        }
      },

      /**
       * #method
       * Width of the SVG legend (consumed by SVGLinearGenomeView), via the
       * shared helper — see `gradientSvgLegendWidth` for why it reserves on
       * the setting alone rather than gating on `hasLegendData`.
       */
      svgLegendWidth(): number {
        return gradientSvgLegendWidth(self)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The shared commit stamps the signature this was fetched for
       * (`GlobalFetchMixin.commitFetchResult`) in the same transaction.
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
        installUpload(self, backend, {
          // Two cells with independent inputs, the matrix from the RPC and the
          // palette from a config slot, so a palette flip re-encodes and
          // re-uploads the ramp alone and a new fetch leaves the ramp be.
          cells: () => {
            const cells = new Map<HicCellKey, HicDataResult | HicColorScheme>()
            if (self.rpcData) {
              cells.set('data', self.rpcData)
            }
            cells.set('colorRamp', self.colorScheme)
            return cells
          },
          encode: cell =>
            typeof cell === 'string' ? generateColorRamp(cell) : cell,
          // The backend answers "did real content reach the canvas" — its own
          // guard (an empty HAL buffer, a colour ramp that has not arrived) is
          // narrower than anything this callback can see.
          render: b => b.render(self.rpcData ?? null, self.renderState),
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
      setAvailableResolutions(f: number[]) {
        // Sort ascending (smallest binsize first) regardless of the order
        // `@gmod/hic` returns, so `resolutionBias` arithmetic is consistent: a
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
       * Lock the display to `availableResolutions[idx]`, stored the way the
       * config slot wants it: an offset from whatever pure auto-mode would pick
       * at the current zoom, so a locked choice keeps shifting consistently as
       * the user zooms rather than pinning an absolute binsize.
       *
       * Both resolution controls write through here. That conversion — "a bias
       * is an index offset from the auto pick" — is one arithmetic fact, and it
       * was stated once per control, each with its own guard against a bad
       * index: one checked membership, the other clamped. Clamping here covers
       * both, so a caller may hand over an out-of-range index without indexing
       * the file's binsize list out of bounds. No-op before the binsize list
       * arrives from CoreGetInfo.
       */
      setResolutionIdx(idx: number) {
        const avail = self.availableResolutions
        if (avail?.length) {
          const clamped = Math.max(0, Math.min(avail.length - 1, idx))
          setConf(self, 'resolutionBias', clamped - self.autoResolutionIdx)
        }
      },
      /**
       * #action
       * Lock to a specific binsize (from the overlay dropdown). No-op if the
       * binsize isn't one the file offers.
       */
      setResolution(binSize: number) {
        const idx = self.availableResolutions?.indexOf(binSize) ?? -1
        if (idx !== -1) {
          this.setResolutionIdx(idx)
        }
      },
      /**
       * #action
       * Step one entry finer (negative delta) or coarser (positive) from the
       * binsize currently in effect. A step at either edge lands on the edge
       * rather than indexing out of bounds — the menu's stepper disables there,
       * and this keeps that from being the only thing standing between a bad
       * index and a fetch.
       */
      stepResolution(delta: number) {
        this.setResolutionIdx(self.effectiveResolutionIdx + delta)
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
      afterAttach() {
        // One-shot header read: the file's normalization and binsize lists.
        // Every contact fetch is gated on it (`prepare` requires
        // `effectiveResolution`, which only exists once `availableResolutions`
        // lands), so a failure here is terminal for this display, not a
        // degradation — hence `setError` rather than a session snackbar; the
        // chrome's retry button re-runs this through the skeleton's
        // `reloadCounter` read. The shared prerequisite-read declaration owns
        // the rest: the adapter-config trigger and key, the minimized gate, the
        // lent status window — the only thing that can narrate a v8 `.hic`'s
        // norm-vector index being discovered by walking the file, since the
        // pre-first-paint scrim is up on `canvasDrawn` rather than on
        // `isLoading` — and the reason there is no `contract` here.
        installPrerequisiteFetch(self, {
          run: async (adapterConfig, ctx) =>
            (await ctx.callRpc('CoreGetInfo', { adapterConfig })) as {
              norms?: string[]
              resolutions?: number[]
            },
          commit: ({ norms, resolutions }) => {
            if (norms) {
              self.setAvailableNormalizations(norms)
            }
            // An empty (or absent) binsize list is terminal for the same
            // reason a thrown CoreGetInfo is, and needs saying just as loudly:
            // it leaves `effectiveResolution` undefined, so `prepare` declines
            // forever with no error set — the display would sit on the loading
            // scrim and `svgReady` would never settle, hanging the whole
            // view's export on an unbounded `awaitSvgReady`. Every resting
            // state that never fetches has to be terminal (ARCHITECTURE.md
            // §"SVG export").
            if (resolutions?.length) {
              self.setAvailableResolutions(resolutions)
            } else {
              self.setError(
                new Error(
                  'No contact-matrix resolutions found in this .hic file',
                ),
              )
            }
          },
          setError: error => {
            self.setError(error)
          },
          // no debounce: the only repeat triggers are a Retry click and an
          // adapter swap, and the first paint waits on this
          delay: 0,
          name: 'LinearHicDisplayInfo',
        })

        installGlobalFetchAutorun(self, {
          // The shared gates (minimized, view not initialized, the byte-gate
          // skip, and the signature against its own stamp) are
          // `installGlobalFetchAutorun`'s declaration over the skeleton, and a
          // signature that is not yet computable declines in the plan's own
          // `prepare`. `viewSignature` reads `effectiveResolution`,
          // which is undefined until availableResolutions arrives from
          // CoreGetInfo — that is the prerequisite gate
          // (`awaitingPrerequisite`), and its arrival rewakes this run through
          // the same tracked read.
          prepare: () => {
            const resolution = self.effectiveResolution
            const blocks = self.host.staticBlocks.contentBlocks
            if (resolution === undefined || !blocks.length) {
              return undefined
            }
            // What only the view knows, resolved here because the worker sees
            // neither the displayed-region axis nor the pre-rename refNames.
            // See HicAxisBlock.
            const { originBp, axisBlocks } = calcAxisBlocks(
              blocks,
              self.host.displayedRegions,
            )
            return {
              resolution,
              regions: [...blocks],
              axisBlocks,
              originBp,
            }
          },
          run: async ({ resolution, regions, axisBlocks, originBp }, ctx) =>
            await ctx.callRpc('RenderHicData', {
              adapterConfig: self.adapterConfig,
              regions,
              axisBlocks,
              originBp,
              resolution,
              ...self.rpcProps(),
            }),
          commit: result => {
            self.setRpcData(result)
          },
          delay: 1000,
          name: 'LinearHicDisplayRender',
        })
      },
    }))
}

export type LinearHicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearHicDisplayModel = Instance<LinearHicDisplayStateModel>
