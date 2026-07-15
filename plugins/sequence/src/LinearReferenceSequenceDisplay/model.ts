import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  addAndShowTrack,
  dedupe,
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionWithAddTracks,
  makeTrackId,
} from '@jbrowse/core/util'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import {
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { type Instance, getEnv, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchEachRegion,
} from '@jbrowse/plugin-linear-genome-view'
import {
  type DisplayPhase,
  computeDisplayPhase,
} from '@jbrowse/render-core/displayPhase'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'

import { buildTextColors } from './components/drawSequence.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'
import { hoverDetailForRow, rowLayout } from './components/sequenceHover.ts'

import type { Canvas2DSequenceRenderer } from './components/Canvas2DSequenceRenderer.ts'
import type { DrawSequenceState } from './components/drawSequence.ts'
import type { SequenceHover } from './components/sequenceHover.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ZOOMED_OUT_BP_PER_PX = 10
const ROW_HEIGHT_PX = 15
const COLLAPSED_HEIGHT_PX = 50

export interface SequenceRegionData {
  seq: string
  start: number
  end: number
  // NCBI genetic-code id for this region's refName (1 = standard); resolved from
  // the assembly's geneticCodes config so mitochondrial/plastid contigs
  // translate with the right table
  geneticCodeId: number
}

/**
 * #stateModel LinearReferenceSequenceDisplay
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
export function modelFactory(configSchema: AnyConfigurationSchemaType) {
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
      sequenceData: observable.map<number, SequenceRegionData>(),
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
       * Theme-derived palette + text colors, derived from the session theme so
       * they're always available — including headless SVG export and RPC, where
       * no component mounts to seed them.
       */
      get colorState() {
        const { theme } = getSession(self)
        const view = getContainingView(self) as LGV
        const palette = buildColorPalette(theme, view.colorByCDS)
        return { palette, textColors: buildTextColors(palette, theme) }
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
       * the view is too zoomed out to show individual bases
       */
      get zoomedOut() {
        const view = getContainingView(self) as LGV
        return view.bpPerPx > ZOOMED_OUT_BP_PER_PX
      },
      /**
       * #getter
       * zoomedOut is a terminal renderable state (static "zoom in" message, no
       * fetch), so it makes `svgReady` resolve even though no data loads. See
       * MultiRegionDisplayMixin.svgReadyExtraTerminal.
       */
      get svgReadyExtraTerminal() {
        return this.zoomedOut
      },
      get numRows() {
        const baseRows =
          (self.showForward ? 1 : 0) + (self.effectiveShowReverse ? 1 : 0)
        // each base row gains 3 stacked translation frames when enabled
        return baseRows * (self.effectiveShowTranslation ? 4 : 1)
      },
      get sequenceHeight() {
        return this.numRows * ROW_HEIGHT_PX
      },
      /**
       * #getter
       * collapses to 50px when zoomed out (no sequence visible) or before
       * the view initializes; otherwise sized to fit the visible rows.
       */
      get computedHeight() {
        return this.zoomedOut ? COLLAPSED_HEIGHT_PX : this.sequenceHeight
      },
      /**
       * #getter
       * override TrackHeightMixin height: use manual resize if set,
       * otherwise the zoom-aware computed height.
       */
      get height() {
        return (
          (getConf(self, 'height') as number | undefined) ?? this.computedHeight
        )
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
        const view = getContainingView(self) as LGV
        const { palette, textColors } = self.colorState
        return {
          bpPerPx: view.bpPerPx,
          showForward: self.showForward,
          showReverse: self.effectiveShowReverse,
          showTranslation: self.effectiveShowTranslation,
          isDna: self.isDna,
          rowHeight: self.rowHeight,
          palette,
          textColors,
          canvasWidth: view.trackWidthPx,
          canvasHeight: self.height,
        }
      },
      /**
       * #getter
       * Same precedence as MultiRegionDisplayMixin plus a zoom gate: when zoomed
       * past base resolution the body shows a "zoom in" message, so suppress the
       * loading phase (fall through to `ready`) and let that message show. The
       * chrome's loading-overlay visibility derives from this overridden getter.
       */
      get displayPhase(): DisplayPhase {
        // fetchCanceled keeps the overlay up (with its retry affordance) after
        // a mid-load cancel, matching MultiRegionDisplayMixin; scoped inside the
        // zoom gate so a zoomed-out state (nothing fetched) still falls through.
        return computeDisplayPhase(
          self,
          () =>
            !self.zoomedOut &&
            (!self.isReady ||
              !self.viewportWithinLoadedData ||
              self.fetchCanceled),
        )
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
        self.configuration.setSlot('showForward', !self.showForward)
        self.configuration.setSlot('height', undefined)
      },
      /**
       * #action
       */
      toggleShowReverse() {
        self.configuration.setSlot('showReverse', !self.showReverse)
        self.configuration.setSlot('height', undefined)
      },
      /**
       * #action
       */
      toggleShowTranslation() {
        self.configuration.setSlot('showTranslation', !self.showTranslation)
        self.configuration.setSlot('height', undefined)
      },
      /**
       * #action
       * spins up a standalone GCContentTrack session track that wraps this
       * track's sequence adapter (requires the gccontent plugin)
       */
      addGCContentTrack() {
        const session = getSession(self)
        const track = getContainingTrack(self)
        if (isSessionWithAddTracks(session)) {
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
            getContainingView(self) as LGV,
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
        installPerRegionLifecycle(
          self,
          self.sequenceData,
          backend,
          data => data,
          (b, regions) => {
            if (self.zoomedOut) {
              return false
            }
            b.renderBlocks(self.renderBlocks, regions, self.renderState)
            return true
          },
        )
      },
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        if (self.zoomedOut) {
          return
        }
        const { rpcManager, assemblyManager } = getSession(self)
        const sessionId = getRpcSessionId(self)
        const adapterConfig = self.adapterConfig
        await fetchEachRegion(self, needed, {
          call: async (region, ctx, displayedRegionIndex) => {
            const features = await rpcManager.call(
              sessionId,
              'CoreGetFeatures',
              {
                regions: [region],
                adapterConfig,
                stopToken: ctx.stopToken,
                statusCallback:
                  self.makeRegionStatusCallback(displayedRegionIndex),
              },
            )
            const geneticCodeId =
              assemblyManager
                .get(region.assemblyName)
                ?.getGeneticCodeId(region.refName) ?? 1
            return { features, geneticCodeId }
          },
          onResult: (idx, { features, geneticCodeId }) => {
            for (const f of dedupe(features, f => f.id())) {
              const seq = f.get('seq') as string | undefined
              if (seq) {
                self.setSequenceRegion(idx, {
                  seq,
                  start: f.get('start'),
                  end: f.get('end'),
                  geneticCodeId,
                })
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
       * tooltip; returns undefined when zoomed out, off a fetched region, or
       * between rows.
       */
      hoverAt(offsetX: number, offsetY: number): SequenceHover | undefined {
        const view = getContainingView(self) as LGV
        const bp = self.zoomedOut ? undefined : view.pxToBp(offsetX)
        if (bp && !bp.oob) {
          const data = self.sequenceData.get(bp.index)
          const idx = data ? bp.coord0 - data.start : -1
          if (data && idx >= 0 && idx < data.seq.length) {
            const row = rowLayout({
              showForward: self.showForward,
              showReverse: self.effectiveShowReverse,
              showTranslation: self.effectiveShowTranslation,
              reversed: !!bp.reversed,
            })[Math.floor(offsetY / self.rowHeight)]
            return {
              refName: bp.refName,
              coord: bp.coord,
              detail: row
                ? hoverDetailForRow(
                    row,
                    data.seq,
                    data.start,
                    bp.coord0,
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
        const hasGCContent =
          !!getEnv(self).pluginManager.getTrackType('GCContentTrack')
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
              ...(hasGCContent
                ? [
                    {
                      label: 'Add GC content track',
                      onClick: () => {
                        self.addGCContentTrack()
                      },
                    },
                  ]
                : []),
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
