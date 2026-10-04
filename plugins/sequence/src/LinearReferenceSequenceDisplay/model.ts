import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import { checkboxItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import {
  getContainingTrack,
  getPaletteHost,
  getSession,
  getDialogHost,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { types } from '@jbrowse/mobx-state-tree'
import {
  containingLgv,
  GetSequenceDialog,
} from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'

import { encodeSequenceCells } from './components/sequenceCells.ts'
import {
  buildColorPalette,
  rowCount,
  rowLayout,
  showsLetters,
} from './components/sequenceGeometry.ts'
import { hoverDetailForRow } from './components/sequenceHover.ts'

import type { ReferenceSeqTrackConfigModel } from '../ReferenceSequenceTrack/configSchema.ts'
import type { SequenceCells } from './components/sequenceCells.ts'
import type {
  CellEncoding,
  ColorPalette,
  RowVisibility,
  SequenceRenderState,
} from './components/sequenceGeometry.ts'
import type { SequenceHover } from './components/sequenceHover.ts'
import type { LinearReferenceSequenceDisplayConfigModel } from './configSchema.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

/**
 * `sequenceType` is the ReferenceSequenceTrack's own slot, not a base track
 * one, and `getContainingTrack` answers `AbstractTrackModel` — a base config.
 * This display only ever sits on that track, so name its schema and the read
 * stays checked.
 */
const referenceSeqTrack = (self: object) =>
  getContainingTrack(self) as unknown as {
    configuration: ReferenceSeqTrackConfigModel
  }

const ZOOMED_OUT_BP_PER_PX = 10
const ROW_HEIGHT_PX = 15
const COLLAPSED_HEIGHT_PX = 50

export interface SequenceRegionData {
  seq: string
  /** absolute genomic start of `seq[0]` */
  start: number
  /** NCBI genetic-code id for this region's refName, from the assembly */
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
    .views(self => ({
      /**
       * #getter
       * The fetched sequence, keyed by displayedRegionIndex — the foundation's
       * per-region store, narrowed.
       */
      get sequenceData(): ReadonlyMap<number, SequenceRegionData> {
        return self.regionPayloads as ReadonlyMap<number, SequenceRegionData>
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get view() {
        return containingLgv(self)
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
        return getConf(referenceSeqTrack(self), 'sequenceType')
      },
      /**
       * #method
       * `colorPalette` in another palette: the SVG export's, whose theme need
       * not be the session's.
       */
      colorPaletteIn(palette: JBrowsePalette): ColorPalette {
        return buildColorPalette(palette, self.view.colorByCDS)
      },
      /**
       * #getter
       * Theme-derived fill and text colour for every cell this display paints
       */
      get colorPalette(): ColorPalette {
        return this.colorPaletteIn(getPaletteHost(self).palette)
      },
      /**
       * #getter
       * the reverse-complement and translation rows are DNA-only
       */
      get isDna() {
        return this.sequenceType === 'dna'
      },
      /**
       * #getter
       */
      get effectiveShowReverse() {
        return this.isDna && this.showReverse
      },
      /**
       * #getter
       */
      get effectiveShowTranslation() {
        return this.isDna && this.showTranslation
      },
      /**
       * #getter
       * Which rows the stack is showing, as the one value `rowLayout` takes
       */
      get rowVisibility(): RowVisibility {
        return {
          showForward: this.showForward,
          showReverse: this.effectiveShowReverse,
          showTranslation: this.effectiveShowTranslation,
        }
      },
      /**
       * #getter
       * What the cells' encode reads beyond the sequence itself
       */
      get cellEncoding(): CellEncoding {
        return {
          ...this.rowVisibility,
          isDna: this.isDna,
          palette: this.colorPalette,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the view is too zoomed out to show individual bases
       */
      get zoomedOut() {
        return self.view.bpPerPx > ZOOMED_OUT_BP_PER_PX
      },
      /**
       * #getter
       * The message shown where the canvas would go: zoomed past base
       * resolution, or every row toggled off (which would otherwise collapse
       * the track to 0px). Undefined when the sequence paints.
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
       * A shown message means no paint is coming. See FetchMixin.fetchInert.
       */
      get fetchInert() {
        return this.placeholderMessage !== undefined
      },
      /**
       * #getter
       */
      get numRows() {
        return rowCount(self.rowVisibility)
      },
      get sequenceHeight() {
        return this.numRows * ROW_HEIGHT_PX
      },
      /**
       * #getter
       * fits the visible rows, or 50px while a message shows
       */
      get computedHeight() {
        return this.placeholderMessage === undefined
          ? this.sequenceHeight
          : COLLAPSED_HEIGHT_PX
      },
      /**
       * #getter
       * a manual resize if set, else `computedHeight`
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
       * everything the marks and the letters need to paint a frame
       */
      get renderState(): SequenceRenderState {
        return {
          ...self.cellEncoding,
          showLetters: showsLetters(self.view.bpPerPx),
          rowHeight: self.rowHeight,
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
        }
      },
    }))
    .actions(self => ({
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
    }))
    .actions(self => ({
      /**
       * #action
       */
      startRenderingBackend(
        backend: PerRegionRenderingBackend<SequenceCells, SequenceRenderState>,
      ) {
        installUpload(self, backend, {
          cells: () => self.sequenceData,
          inputs: () => ({
            encoding: self.cellEncoding,
            reversed: self.view.displayedRegions.map(r => !!r.reversed),
          }),
          encode: (data, { encoding, reversed }, key) =>
            encodeSequenceCells(data, encoding, !!reversed[key]),
          render: (b, encoded) =>
            self.rendersCanvas &&
            b.renderBlocks(self.renderBlocks, encoded, self.renderState),
        })
      },
      async fetchNeeded(needed: IndexedRegion[]) {
        // not `rendersCanvas`: re-ticking a row moves nothing the fetch
        // autorun tracks, so declining on no-rows would wedge the display
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
          onResult: (_idx, { features, geneticCodeId }, region) => {
            for (const f of features) {
              const seq = f.get('seq') as string | undefined
              if (seq) {
                return {
                  seq,
                  start: f.get('start'),
                  geneticCodeId,
                } satisfies SequenceRegionData
              }
            }
            // an empty record, so the plan stops re-issuing the region
            return {
              seq: '',
              start: region.start,
              geneticCodeId,
            } satisfies SequenceRegionData
          },
        })
      },
    }))
    .views(self => {
      const superTrackMenuItems = self.trackMenuItems
      return {
        /**
         * #method
         * Resolve the genomic position, reference base, and codon/amino-acid under
         * a cursor at track-relative pixel `(offsetX, offsetY)`. Drives the hover
         * tooltip; returns undefined when no sequence is painted, off a fetched
         * region, or between rows.
         */
        hoverAt(offsetX: number, offsetY: number): SequenceHover | undefined {
          // rendersCanvas also rules out the zero-row case the division needs
          const bp = self.rendersCanvas ? self.view.pxToBp(offsetX) : undefined
          if (bp && !bp.oob) {
            // not bp.coord0, which on a reversed block names the base to the
            // right of the one drawn under the cursor
            const base = basePaintedAt(bp, bp.offset)
            const data = self.sequenceData.get(bp.index)
            const idx = data ? base - data.start : -1
            if (data && idx >= 0 && idx < data.seq.length) {
              const row = rowLayout(self.rowVisibility, !!bp.reversed)[
                Math.floor(offsetY / self.rowHeight)
              ]
              return {
                refName: bp.refName,
                coord: base + 1,
                detail: row
                  ? hoverDetailForRow(
                      row,
                      data.seq,
                      data.start,
                      base,
                      !!bp.reversed,
                      self.isDna,
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
          return [
            ...superTrackMenuItems(),
            {
              label: LAUNCH_LABEL,
              type: 'subMenu' as const,
              subMenu: [
                {
                  label: 'Get sequence (visible region)',
                  onClick: () => {
                    const { view } = self
                    // a fractional span comes back from fetchSequence the
                    // wrong length
                    const regions = view.visibleWholeBaseRegions
                    if (!regions.length) {
                      return
                    }
                    getDialogHost(self).queueDialog(handleClose => [
                      GetSequenceDialog,
                      { model: view, regions, handleClose },
                    ])
                  },
                },
              ],
            },
            ...makeShowSubMenu([
              checkboxItem('Show forward', self.showForward, () => {
                self.toggleShowForward()
              }),
              ...(self.isDna
                ? [
                    checkboxItem('Show reverse', self.showReverse, () => {
                      self.toggleShowReverse()
                    }),
                    checkboxItem(
                      'Show translation',
                      self.showTranslation,
                      () => {
                        self.toggleShowTranslation()
                      },
                    ),
                  ]
                : []),
            ]),
          ]
        },
      }
    })
}

export type LinearReferenceSequenceDisplayStateModel = ReturnType<
  typeof modelFactory
>
export type LinearReferenceSequenceDisplayModel =
  Instance<LinearReferenceSequenceDisplayStateModel>
