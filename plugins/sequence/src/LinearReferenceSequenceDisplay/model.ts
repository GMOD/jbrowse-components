import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { installPerRegionLifecycle } from '@jbrowse/core/gpu/installPerRegionLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  dedupe,
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { type Instance, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import type { Canvas2DSequenceRenderer } from './components/Canvas2DSequenceRenderer.ts'
import type {
  DrawSequenceState,
  TextColors,
} from './components/drawSequence.ts'
import type { ColorPalette } from './components/sequenceGeometry.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ZOOMED_OUT_BP_PER_PX = 10

export interface SequenceRegionData {
  seq: string
  start: number
  end: number
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
        /**
         * #property
         */
        showForward: true,
        /**
         * #property
         */
        showReverse: true,
        /**
         * #property
         */
        showTranslation: true,
      }),
    )
    .volatile(() => ({
      sequenceData: observable.map<number, SequenceRegionData>(),
      /**
       * #volatile
       * theme-derived colors, pushed from the component (theme lives in
       * React/MUI). Feeds `renderState`; until set, `renderState` is undefined
       * and the render autorun skips — same pattern as wiggle/MAF.
       */
      colorState: undefined as
        | { palette: ColorPalette; textColors: TextColors }
        | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sequenceType() {
        return getConf(getContainingTrack(self), 'sequenceType')
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
      get numRows() {
        const baseRows =
          (self.showForward ? 1 : 0) + (self.effectiveShowReverse ? 1 : 0)
        // each base row gains 3 stacked translation frames when enabled
        return baseRows * (self.effectiveShowTranslation ? 4 : 1)
      },
      get sequenceHeight() {
        return this.numRows * 15
      },
      /**
       * #getter
       * collapses to 50px when zoomed out (no sequence visible) or before
       * the view initializes; otherwise sized to fit the visible rows.
       */
      get computedHeight() {
        return this.zoomedOut ? 50 : this.sequenceHeight
      },
      /**
       * #getter
       * override TrackHeightMixin height: use manual resize if set,
       * otherwise the zoom-aware computed height.
       */
      get height() {
        return self.heightPreConfig ?? this.computedHeight
      },
      get rowHeight() {
        return this.numRows > 0 ? this.height / this.numRows : 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * everything the Canvas2D backend needs to paint a frame, or undefined
       * until the theme-derived colors arrive (render autorun skips on
       * undefined).
       */
      get renderState(): DrawSequenceState | undefined {
        const { colorState } = self
        if (!colorState) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        return {
          bpPerPx: view.bpPerPx,
          showForward: self.showForward,
          showReverse: self.effectiveShowReverse,
          showTranslation: self.effectiveShowTranslation,
          sequenceType: self.sequenceType,
          rowHeight: self.rowHeight,
          palette: colorState.palette,
          textColors: colorState.textColors,
          canvasWidth: view.trackWidthPx,
          canvasHeight: self.height,
        }
      },
      /**
       * #getter
       * Same policy as MultiRegionDisplayMixin plus a zoom gate: when zoomed
       * past base resolution the body shows a "zoom in" message, so the
       * loading scrim must stay hidden over it.
       */
      get loadingOverlayVisible() {
        return (
          !self.zoomedOut &&
          (!self.isReady || !self.viewportWithinLoadedData) &&
          !self.regionTooLarge &&
          !self.error &&
          !self.renderError
        )
      },
    }))
    .actions(self => ({
      setSequenceRegion(idx: number, data: SequenceRegionData) {
        self.sequenceData.set(idx, data)
      },
      /**
       * #action
       * push theme-derived colors in from the component
       */
      setColorState(palette: ColorPalette, textColors: TextColors) {
        self.colorState = { palette, textColors }
      },
      clearDisplaySpecificData() {
        self.sequenceData.clear()
      },
      /**
       * #action
       */
      toggleShowForward() {
        self.showForward = !self.showForward
        self.heightPreConfig = undefined
      },
      /**
       * #action
       */
      toggleShowReverse() {
        self.showReverse = !self.showReverse
        self.heightPreConfig = undefined
      },
      /**
       * #action
       */
      toggleShowTranslation() {
        self.showTranslation = !self.showTranslation
        self.heightPreConfig = undefined
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
            const state = self.renderState
            if (!state || self.zoomedOut) {
              return false
            }
            b.renderBlocks(self.renderBlocks, regions, state)
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
        await self.fetchRegions(needed, async ctx => {
          const { rpcManager } = getSession(self)
          const sessionId = getRpcSessionId(self)
          const adapterConfig = self.adapterConfig
          for (const { region, displayedRegionIndex } of needed) {
            const features = await rpcManager.call(
              sessionId,
              'CoreGetFeatures',
              { regions: [region], adapterConfig, stopToken: ctx.stopToken },
            )
            if (ctx.isStale()) {
              return
            }
            for (const f of dedupe(features, f => f.id())) {
              const seq = f.get('seq') as string | undefined
              if (seq) {
                self.setSequenceRegion(displayedRegionIndex, {
                  seq,
                  start: f.get('start'),
                  end: f.get('end'),
                })
              }
            }
          }
        })
      },
    }))
    .views(self => ({
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
    .postProcessSnapshot(snap => {
      const { showForward, showReverse, showTranslation, ...rest } = snap
      return {
        ...rest,
        ...(showForward ? {} : { showForward }),
        ...(showReverse ? {} : { showReverse }),
        ...(showTranslation ? {} : { showTranslation }),
      } as typeof snap
    })
}

export type LinearReferenceSequenceDisplayStateModel = ReturnType<
  typeof modelFactory
>
export type LinearReferenceSequenceDisplayModel =
  Instance<LinearReferenceSequenceDisplayStateModel>
