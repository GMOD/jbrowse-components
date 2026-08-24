import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  addAndShowTrack,
  getContainingTrack,
  getContainingView,
  getPaletteHost,
  getSession,
  isSessionWithAddSessionTrack,
  makeTrackId,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import MultiRegionDisplayMixin, {
  fetchEachRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import {
  installPerRegionLifecycle,
  regionDataMap,
} from '@jbrowse/render-core/installPerRegionLifecycle'

import {
  buildColorPalette,
  rowCount,
  rowLayout,
} from './components/sequenceGeometry.ts'
import { hoverDetailForRow } from './components/sequenceHover.ts'

import type { Canvas2DSequenceRenderer } from './components/Canvas2DSequenceRenderer.ts'
import type { DrawSequenceState } from './components/drawSequence.ts'
import type {
  ColorPalette,
  RowVisibility,
} from './components/sequenceGeometry.ts'
import type { SequenceHover } from './components/sequenceHover.ts'
import type { LinearReferenceSequenceDisplayConfigModel } from './configSchema.ts'
import type { Region } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ZOOMED_OUT_BP_PER_PX = 10
const ROW_HEIGHT_PX = 15
const COLLAPSED_HEIGHT_PX = 50

export interface SequenceRegionData {
  seq: string
  // absolute genomic start of `seq[0]`; the extent is `start + seq.length`, so
  // there is no separate `end` to keep in agreement with the string
  start: number
  // NCBI genetic-code id for this region's refName (1 = standard); resolved from
  // the assembly's geneticCodes config so mitochondrial/plastid contigs
  // translate with the right table
  geneticCodeId: number
}

/**
 * #stateModel LinearReferenceSequenceDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`
 *
 * #example
 * A complete `ReferenceSequenceTrack` config to paste into `tracks` (an
 * assembly's `sequence` track takes the same shape). `showForward`,
 * `showReverse`, and `showTranslation` toggle the strand/translation rows:
 * ```js
 * {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'refseq',
 *   name: 'Reference sequence',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'IndexedFastaAdapter',
 *     uri: 'https://example.com/genome.fa',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearReferenceSequenceDisplay',
 *       displayId: 'refseq-LinearReferenceSequenceDisplay',
 *       showTranslation: false,
 *     },
 *   ],
 * }
 * ```
 */
export function modelFactory(
  configSchema: LinearReferenceSequenceDisplayConfigModel,
) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReferenceSequenceDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      sequenceData: regionDataMap<SequenceRegionData>('sequenceData'),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get view() {
        return getContainingView(self) as LinearGenomeViewModel
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get showForward(): boolean {
        return getConf(self, 'showForward')
      },
      /**
       * #getter
       */
      get showReverse(): boolean {
        return getConf(self, 'showReverse')
      },
      /**
       * #getter
       */
      get showTranslation(): boolean {
        return getConf(self, 'showTranslation')
      },
      /**
       * #getter
       */
      get sequenceType() {
        return getConf(getContainingTrack(self), 'sequenceType')
      },
      /**
       * #getter
       * Theme-derived fill + text color for every cell this display paints,
       * derived from the session theme so it's always available — including
       * headless SVG export and RPC, where no component mounts to seed it.
       */
      get colorPalette(): ColorPalette {
        return buildColorPalette(
          getPaletteHost(self).palette,
          self.view.colorByCDS,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * true for DNA tracks; reverse-complement and translation rows are
       * gated on this since they are biologically meaningful only for DNA.
       */
      get isDna() {
        return self.sequenceType === 'dna'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * reverse-complement row is meaningful only for DNA
       */
      get effectiveShowReverse() {
        return self.isDna && self.showReverse
      },
      /**
       * #getter
       * translation rows are meaningful only for DNA
       */
      get effectiveShowTranslation() {
        return self.isDna && self.showTranslation
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Which rows the stack is showing, as the one value `rowLayout` takes.
       * Every consumer — the row count, the render state, the hover's mouse-y
       * lookup — goes through this rather than re-listing three booleans and
       * having to remember which two of them are the DNA-gated `effective`
       * ones.
       */
      get rowVisibility(): RowVisibility {
        return {
          showForward: self.showForward,
          showReverse: self.effectiveShowReverse,
          showTranslation: self.effectiveShowTranslation,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the view is too zoomed out to show individual bases
       */
      get zoomedOut() {
        const view = self.lgv
        return view.bpPerPx > ZOOMED_OUT_BP_PER_PX
      },
      /**
       * #getter
       * The static message `SequenceDisplayComponent` renders where the
       * `<canvas>` would go, or undefined when the sequence actually paints.
       *
       * Two states reach it, and having one term for both is the point. Zoomed
       * past base resolution there is nothing to draw and nothing is fetched;
       * with every row toggled off there is likewise nothing to draw, and that
       * case used to reach only `computedHeight` — `numRows * ROW_HEIGHT_PX` is
       * 0, so unticking both strand rows collapsed the track to a 0px sliver
       * with no message and nothing left to grab.
       */
      get placeholderMessage(): string | undefined {
        return this.zoomedOut
          ? 'Zoom in to see sequence'
          : this.numRows === 0
            ? 'No sequence rows shown — enable one from the track menu'
            : undefined
      },
      /**
       * #getter
       * Showing the message means `canvasRef` is never called and `canvasDrawn`
       * can never flip. Overrides `RenderLifecycleMixin`'s default-true hook,
       * which is what makes `painted` — and so `data-display-drawn`, which
       * `PENDING_DISPLAYS` selects on — report finished instead of hanging
       * every `waitForDisplaysDone` on a page that shows the reference sequence
       * track zoomed out.
       *
       * The two hooks below are the same condition on the other two axes.
       * Three hooks for one fact looks redundant and isn't: they answer the
       * scrim, the SVG export and first paint, and each has a different set of
       * readers — but only this one states the condition, so they cannot drift.
       */
      get rendersCanvas() {
        return this.placeholderMessage === undefined
      },
      /**
       * #getter
       * Past base resolution the body is a static message and no fetch is
       * coming, which is what every consumer of this hook needs to know: the
       * loading scrim must not cover it, and `svgReady` must resolve without
       * data. See FetchMixin.fetchInert.
       */
      get fetchInert() {
        return !this.rendersCanvas
      },
      /**
       * #getter
       * height of the stack in rows, counted off the same `rowLayout` the
       * painter walks and the hover indexes
       */
      get numRows() {
        return rowCount(self.rowVisibility)
      },
      get sequenceHeight() {
        return this.numRows * ROW_HEIGHT_PX
      },
      /**
       * #getter
       * collapses to 50px whenever the body is a static message instead of the
       * sequence; otherwise sized to fit the visible rows.
       */
      get computedHeight() {
        return this.rendersCanvas ? this.sequenceHeight : COLLAPSED_HEIGHT_PX
      },
      /**
       * #getter
       * override TrackHeightMixin height: use manual resize if set,
       * otherwise the zoom-aware computed height.
       */
      get height() {
        return getConf(self, 'height') ?? this.computedHeight
      },
      get rowHeight() {
        return this.numRows > 0 ? this.height / this.numRows : 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * everything the Canvas2D backend needs to paint a frame
       */
      get renderState(): DrawSequenceState {
        return {
          ...self.rowVisibility,
          bpPerPx: self.lgv.bpPerPx,
          isDna: self.isDna,
          rowHeight: self.rowHeight,
          palette: self.colorPalette,
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
        }
      },
    }))
    .actions(self => ({
      setSequenceRegion(idx: number, data: SequenceRegionData) {
        self.sequenceData.set(idx, data)
      },
      clearDisplaySpecificData() {
        self.sequenceData.clear()
      },
      /**
       * #action
       */
      toggleShowForward() {
        setConf(self, 'showForward', !self.showForward)
        setConf(self, 'height', undefined)
      },
      /**
       * #action
       */
      toggleShowReverse() {
        setConf(self, 'showReverse', !self.showReverse)
        setConf(self, 'height', undefined)
      },
      /**
       * #action
       */
      toggleShowTranslation() {
        setConf(self, 'showTranslation', !self.showTranslation)
        setConf(self, 'height', undefined)
      },
      /**
       * #action
       * spins up a standalone GCContentTrack session track that wraps this
       * track's sequence adapter (requires the gccontent plugin).
       *
       * Not on this display's menu: the gccontent plugin puts the item there
       * itself, through `Core-extraTrackMenuItems`, which reaches the
       * hierarchical selector's track menu as well as this one. A copy here
       * showed it twice on an open reference sequence track, and had to ask
       * whether the plugin was loaded — through `getTrackType`, which throws
       * rather than answering no. Kept as an action because it is callable API.
       */
      addGCContentTrack() {
        const session = getSession(self)
        const track = getContainingTrack(self)
        if (isSessionWithAddSessionTrack(session)) {
          const name = 'GC content'
          addAndShowTrack(
            session,
            {
              trackId: makeTrackId({ name }),
              type: 'GCContentTrack',
              name,
              assemblyNames: getTrackAssemblyNames(track),
              adapter: {
                type: 'GCContentAdapter',
                sequenceAdapter: getConf(track, 'adapter'),
              },
            },
            self.view,
          )
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Called by `useRenderingBackend` (via DisplayChrome) once the canvas
       * backend is created. Streams each fetched region into the backend and
       * draws every frame from `renderState`.
       */
      startRenderingBackend(backend: Canvas2DSequenceRenderer) {
        installPerRegionLifecycle(self, backend, {
          data: () => self.sequenceData,
          render: (b, regions) =>
            self.rendersCanvas &&
            b.renderBlocks(self.renderBlocks, regions, self.renderState),
        })
      },
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        // `zoomedOut`, deliberately *not* the wider `rendersCanvas`: a
        // `fetchNeeded` that declines has to be woken by something the
        // FetchVisibleRegions autorun already tracks (see
        // BaseLinearDisplay/CLAUDE.md). Zooming back in moves
        // `view.visibleRegions`, which it does track; re-ticking a strand row
        // moves nothing it watches, so skipping on no-rows would wedge the
        // display until the user happened to pan. Fetching sequence nobody
        // paints for as long as every row is off is the cheaper mistake.
        if (self.zoomedOut) {
          return
        }
        const { assemblyManager } = getSession(self)
        const adapterConfig = self.adapterConfig
        await fetchEachRegion(self, needed, {
          call: async (region, ctx) => {
            const features = await ctx.callRpc('CoreGetFeatures', {
              regions: [region],
              adapterConfig,
            })
            const geneticCodeId =
              assemblyManager
                .get(region.assemblyName)
                ?.getGeneticCodeId(region.refName) ?? 1
            return { features, geneticCodeId }
          },
          onResult: (idx, { features, geneticCodeId }) => {
            // every sequence adapter answers a region with a single feature
            // carrying the whole string; take the first that has one rather
            // than looping and overwriting the same key, which kept whichever
            // happened to come last
            for (const f of features) {
              const seq = f.get('seq') as string | undefined
              if (seq) {
                self.setSequenceRegion(idx, {
                  seq,
                  start: f.get('start'),
                  geneticCodeId,
                })
                break
              }
            }
          },
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       * Resolve the genomic position, reference base, and codon/amino-acid under
       * a cursor at track-relative pixel `(offsetX, offsetY)`. Drives the hover
       * tooltip; returns undefined when no sequence is painted, off a fetched
       * region, or between rows.
       */
      hoverAt(offsetX: number, offsetY: number): SequenceHover | undefined {
        // nothing painted, nothing under the cursor — and this is also what
        // makes the `rowHeight` division below safe, since `rendersCanvas`
        // false is exactly the zoomed-out and zero-row cases
        const bp = self.rendersCanvas ? self.view.pxToBp(offsetX) : undefined
        if (bp && !bp.oob) {
          // basePaintedAt, not bp.coord0: this indexes the fetched sequence, so
          // it has to name the base drawn under the cursor. Reversed, coord0
          // names the one to its right — and on the region's first column names
          // a base past its end, which read as "no hover here" rather than as a
          // wrong letter. Safe to ask here because oob is already ruled out.
          const base = basePaintedAt(bp, bp.offset)
          const data = self.sequenceData.get(bp.index)
          const idx = data ? base - data.start : -1
          if (data && idx >= 0 && idx < data.seq.length) {
            const row = rowLayout(self.rowVisibility, !!bp.reversed)[
              Math.floor(offsetY / self.rowHeight)
            ]
            return {
              refName: bp.refName,
              // 1-based display form of the base actually under the cursor
              coord: base + 1,
              detail: row
                ? hoverDetailForRow(
                    row,
                    data.seq,
                    data.start,
                    base,
                    !!bp.reversed,
                    getGeneticCode(data.geneticCodeId).codonTable,
                  )
                : undefined,
            }
          }
        }
        return undefined
      },
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
      /**
       * #method
       */
      trackMenuItems() {
        return self.isDna
          ? [
              {
                label: 'Show forward',
                type: 'checkbox',
                checked: self.showForward,
                onClick: () => {
                  self.toggleShowForward()
                },
              },
              {
                label: 'Show reverse',
                type: 'checkbox',
                checked: self.showReverse,
                onClick: () => {
                  self.toggleShowReverse()
                },
              },
              {
                label: 'Show translation',
                type: 'checkbox',
                checked: self.showTranslation,
                onClick: () => {
                  self.toggleShowTranslation()
                },
              },
            ]
          : []
      },
    }))
}

export type LinearReferenceSequenceDisplayStateModel = ReturnType<
  typeof modelFactory
>
export type LinearReferenceSequenceDisplayModel =
  Instance<LinearReferenceSequenceDisplayStateModel>
