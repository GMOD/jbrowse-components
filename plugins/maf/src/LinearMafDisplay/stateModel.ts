import {
  coverageAutoscaleViews,
  coverageDomainViews,
  coverageStatsViews,
  coverageTicksViews,
} from '@jbrowse/alignments-core'
import {
  COVERAGE_Y_PATHS,
  coverageBandSlotActions,
  coverageBandSlotViews,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { getCoverageMenuItems } from '@jbrowse/alignments-core/coverageMenuItems'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { withHint } from '@jbrowse/core/ui/menuItems'
import {
  assembleLocString,
  getDialogHost,
  getEnv,
  getPaletteHost,
  getSession,
} from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import CoarseTierMixin from '@jbrowse/display-kit/CoarseTierMixin'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import {
  TreeSidebarMixin,
  resetRowOrderMenuItems,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
  sortRowsHereMenuItem,
} from '@jbrowse/tree-sidebar'
import { ScoreScaleMixin } from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { getMafColorPalette } from '../LinearMafRenderer/util.ts'
import { configSlotActions, configSlotViews } from './configSlotViews.ts'
import { fetchMafAlignmentData, fetchMafSummaryData } from './fetchMafData.ts'
import { mafLaunchMenuItems } from './launchMenuItems.ts'
import { mafBandActions, mafBandViews } from './mafBandViews.ts'
import { MAF_FIELD_PRESETS } from './mafColorConfigSchema.ts'
import {
  mafCoverageHoverViews,
  mafCoverageSource,
  mafCoverageViews,
} from './mafCoverageViews.ts'
import {
  mafEncodedUploadViews,
  mafLegendViews,
  mafRefNameRankViews,
  mafRowPlanViews,
  mafRowsEncodeViews,
} from './mafEncodeViews.ts'
import { mafHoverViews } from './mafHoverViews.ts'
import { mafCodonGlyphViews, mafOverlayViews } from './mafOverlayViews.ts'
import { mafDrawnRowViews, mafRowActions, mafRowViews } from './mafRowViews.ts'
import { openInsertionWidget } from './openInsertionWidget.ts'
import { orderMafRowsByBaseAt } from './orderMafRowsByBaseAt.ts'
import { placeMafRegionData } from './placeMafRows.ts'
import { rowNavigationTargetsOf } from './rowNavigationTargets.ts'
import {
  ZOOM_IN_FOR_BAND,
  buildMafTrackMenuItems,
  zoomGatedItem,
} from './trackMenuItems.ts'

import type {
  MafRegionData,
  MafRenderingBackend,
  MafWireRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type {
  MafFrameRecord,
  MafRegionPayload,
  MafRow,
  MafSummaryRecord,
} from '../types.ts'
import type { MafRowGeometryParams } from './components/visibleRegionGeometry.ts'
import type { LinearMafDisplayConfigModel } from './configSchema.ts'
import type { MafHover } from './util.ts'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type {
  CoarseTierRead,
  CoarseTierResult,
} from '@jbrowse/display-kit/coarseTier'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * The row under the pointer, published as `hoveredFeature` so another display
 * in the view can tell which sample it is on
 */
export interface MafRowHover {
  name: string
}

// A right-click's reference column plus the hit under it, resolved once so menu
// items need not re-run the hit test against a closed anchor.
export interface MafContextMenuInfo extends ContextMenuAnchor {
  refName: string
  pos: number
  hover?: MafHover
}

const NO_DETAIL: ReadonlyMap<number, MafRegionData> = new Map()

/**
 * #stateModel LinearMafDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * Draws the multiple alignment in a `MafTrack`, one row per aligned species,
 * under a conservation band.
 *
 * #example
 * A complete `MafTrack` config to paste into `tracks`. `samples` lists the
 * aligned species in track order; the rows divide the track `height` the
 * bands leave between them:
 * ```js
 * {
 *   type: 'MafTrack',
 *   trackId: 'multiz',
 *   name: 'Multiz alignment',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BigMafAdapter',
 *     bigBedLocation: { uri: 'https://example.com/multiz.bb' },
 *     samples: ['hg38', 'panTro4', 'mm10'],
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMafDisplay',
 *       displayId: 'multiz-LinearMafDisplay',
 *       height: 400,
 *       coverage: { show: true },
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: LinearMafDisplayConfigModel,
) {
  return (
    types
      // #region compose
      .compose(
        'LinearMafDisplay',
        types.compose(
          BaseDisplay,
          TrackHeightMixin(),
          MultiRegionDisplayMixin(),
        ),
        StoredHoverMixin<MafRowHover>((a, b) => a.name === b.name),
        CoarseTierMixin<MafRegionPayload<MafSummaryRecord[]>>(),
        LegendMixin(),
        ColorWritesMixin(),
        TreeSidebarMixin<MafRow>(),
        ContextMenuMixin<MafContextMenuInfo>(),
        ScoreScaleMixin(COVERAGE_Y_PATHS),
        types.model({
          /**
           * #property
           */
          type: types.literal('LinearMafDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
        }),
      )
      // #endregion
      .volatile(
        (): {
          framesGateBlocked: boolean
          reportedRows: MafRow[]
          treeNewickVolatile: string | undefined
          speciesListed: boolean
          sampleWarnings: string[]
          refSampleIdVolatile: string | undefined
        } => ({
          /**
           * #volatile
           * The `byteLimit` refused the last frames fetch, so the strip
           * stops drawing; the menu reads this to say so.
           *
           * Never in `rpcProps()`: the fetch writes it, the loop trap
           * FETCH_KEYS.md names.
           */
          framesGateBlocked: false,
          /**
           * #volatile
           * The worker's authoritative row set, in tree (leaf) order.
           * `arrangedRows` arranges and colors it by `rows`, and `drawnRows`
           * narrows that by the focus.
           */
          reportedRows: [],
          /**
           * #volatile
           * The adapter's guide tree as newick, which `rowTree` draws while some
           * rotation of it lists `rows.sort` in order.
           */
          treeNewickVolatile: undefined,
          /**
           * #volatile
           * Whether the adapter lists its species, by a `samples` config or its
           * guide tree, rather than discovering them from the blocks it reads.
           */
          speciesListed: false,
          /**
           * #volatile
           * What the adapter's samples table disagreed with its species about.
           */
          sampleWarnings: [],
          /**
           * #volatile
           * The reference sample row the worker resolved, held here because the
           * region store that delivers it empties on chromosome navigation.
           *
           * Last write wins, not a latch: a re-pointed adapter or edited
           * `refAssemblyName` keeps the display instance.
           */
          refSampleIdVolatile: undefined,
        }),
      )
      .views(self => ({
        /**
         * #getter
         * The linear genome view the track is in, which the mixins' `host`
         * also names: everything here reads the view through this one.
         */
        get view() {
          return containingLgv(self)
        },
        /**
         * #getter
         * A band's y-axis, else the species rows and their names, sits at
         * the top-left.
         */
        get prefersOffset() {
          return true
        },
      }))
      .views(configSlotViews)
      .actions(configSlotActions)
      .views(coverageBandSlotViews)
      .actions(coverageBandSlotActions)
      .actions(self => ({
        /**
         * #action
         * Paint identity along a named ramp (`colorByScheme`).
         */
        setColorScheme(scheme: ColorSchemeName) {
          self.colorByScheme(scheme, MAF_FIELD_PRESETS.identity.scale.scheme)
        },
      }))
      .actions(mafRowActions)
      .views(mafRowViews)
      .views(self => ({
        /**
         * #getter
         * The MAF adapter's `framesAdapter` (UCSC `mafFrames`), or undefined.
         * Read by slot path off the live parent track, since a slot read
         * against a snapshot misses defaulted slots.
         */
        get framesAdapterConfig(): Record<string, unknown> | undefined {
          return getConf(self.parentTrack, ['adapter', 'framesAdapter'])
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The CDS frame strip draws: a frames adapter is configured and
         * `alignments.frames.show` is on.
         */
        get framesActive(): boolean {
          return self.showFrames && !!self.framesAdapterConfig
        },
        /**
         * #getter
         * A frames adapter is configured and something reads its frames: the
         * strip, the codon view or the codon band.
         */
        get framesInUse(): boolean {
          return (
            (self.showFrames ||
              self.basesField === 'codon' ||
              (self.showConservation && self.conservationUnit === 'codon')) &&
            !!self.framesAdapterConfig
          )
        },
      }))
      .views(mafDrawnRowViews)
      .views(self => ({
        /**
         * #getter
         */
        get coarseAdapterSlot() {
          return 'summaryAdapter'
        },
        /**
         * #getter
         * Whether the view is zoomed out past the force-load floor, read from
         * `RegionTooLargeMixin`'s gate so the tier swap and the gate agree on
         * the floor.
         */
        get coarseTierPastThreshold() {
          return self.aboveForceLoadFloor
        },
        /**
         * #getter
         * What the summary RPC reads beyond its regions and byte budget: the
         * adapter and the focus it filters records by. The detail fetch's
         * other settings never reach it.
         */
        get summaryReadArgs() {
          return {
            adapterConfig: self.adapterConfig,
            rowFocus: self.rowFocusKey,
          }
        },
        /**
         * #getter
         * `summaryReadArgs`, and whether the strip wants frames read beside
         * the summary: the detail tier always reads them, the summary tier
         * only for the strip.
         */
        get coarseReadKey() {
          return {
            args: this.summaryReadArgs,
            frames: self.framesActive,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The detail tier's store: `MultiRegionDisplayMixin`'s per-region
         * payloads narrowed to the worker's columnar rows plus the CDS frames
         * from the same fetch. A reorder re-places from here without
         * refetching.
         */
        get detailPayloads(): ReadonlyMap<
          number,
          MafRegionPayload<MafWireRegionData>
        > {
          return self.regionPayloads as ReadonlyMap<
            number,
            MafRegionPayload<MafWireRegionData>
          >
        },
      }))
      .views(self => {
        const placed = createEncodeMemo(
          () => self.detailPayloads,
          () => self.rowIndexBySrc,
          (payload, rowIndexBySrc) =>
            placeMafRegionData(payload.data, rowIndexBySrc),
        )
        return {
          /**
           * #getter
           * `detailPayloads` with every row assigned its on-screen `rowIndex`
           * (`placeMafRegionData`). Everything that draws, hit-tests or
           * measures rows reads this.
           *
           * The memo is held in this closure so it outlives a context-loss recovery;
           * `afterAttach` installs the observer it needs.
           */
          get rpcDataMap(): ReadonlyMap<number, MafRegionData> {
            return placed()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * `rpcDataMap` while the detail tier draws, and nothing on the summary
         * tier: `CoarseTierMixin` keeps the detail store under the tier, so
         * whatever marks, hovers or navigates by the alignment reads this.
         */
        get detailOnScreen(): ReadonlyMap<number, MafRegionData> {
          return self.coarseTierActive ? NO_DETAIL : self.rpcDataMap
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-region CDS frame rows (UCSC `mafFrames`) for the frames strip.
         * The tier on screen is checked first and the other tier fills gaps,
         * so the strip stays visible across the summary-detail swap.
         */
        get framesDataMap(): ReadonlyMap<number, MafFrameRecord[]> {
          const detail = self.detailPayloads
          const summary = self.coarseTier
          const [first, second] = self.coarseTierActive
            ? [summary, detail]
            : [detail, summary]
          const frames = new Map<number, MafFrameRecord[]>()
          for (const tier of [second, first]) {
            for (const [displayedRegionIndex, payload] of tier) {
              if (payload.frames) {
                frames.set(displayedRegionIndex, payload.frames)
              }
            }
          }
          return frames
        },
      }))
      .views(mafBandViews)
      .actions(mafBandActions)
      .actions(self => ({
        /**
         * #action
         * Reorder the rows by the base each species has in the reference
         * column at (refName, pos), writing the order to `rows.sort` as
         * clustering and the arrangement dialog do, so "Reset row order" undoes
         * all three.
         *
         * Declines with fewer than two rows or at a column no loaded region
         * covers; `sortRowsAtColumn` owns both gates and the returned "did it
         * sort".
         */
        sortRowsByBaseAt(refName: string, pos: number) {
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => self.detailOnScreen.get(index),
            (rows, region) =>
              orderMafRowsByBaseAt(rows, self.drawnRows, region, pos),
          )
        },
      }))
      .views(self => ({
        /**
         * #method
         * Items for the right-click menu, built from the column under the
         * click. Captured when the menu opens, since `closeContextMenu`
         * runs before an item's onClick.
         */
        contextMenuItems(): MenuItem[] {
          const info = self.contextMenuInfo
          const zoomHint = self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined
          const insertion =
            info?.hover?.kind === 'insertion' ? info.hover : undefined
          return info
            ? [
                {
                  label: 'Copy location',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    void copyText(
                      self,
                      assembleLocString({
                        refName: info.refName,
                        start: info.pos,
                        end: info.pos + 1,
                      }),
                      'location',
                    )
                  },
                },
                ...(insertion
                  ? [
                      {
                        label: 'Open insertion details',
                        icon: MenuOpenIcon,
                        onClick: () => {
                          openInsertionWidget(self, insertion)
                        },
                      },
                    ]
                  : []),
                zoomGatedItem(
                  sortRowsHereMenuItem({
                    label: withHint('Sort rows by base here', zoomHint),
                    rowCount: self.arrangedRows.length,
                    onClick: () => {
                      self.sortRowsByBaseAt(info.refName, info.pos)
                    },
                  }),
                  zoomHint,
                ),
                ...resetRowOrderMenuItems(self),
              ]
            : []
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Theme-derived color palette (per-base colors plus match, gap,
         * mismatch, unknown, insertion), read by `rowsEncodeProps()` and
         * `renderState`. Derived from the session theme, so it exists in
         * headless SVG export and RPC. A theme change re-encodes on the main
         * thread without a refetch.
         */
        // #region colorPalette
        get colorPalette(): MafColorPalette {
          return getMafColorPalette(getPaletteHost(self).palette)
        },
        // #endregion
        /**
         * #getter
         * Genomic bp the GPU encoder merges into one cell: the foundation's
         * `settledSubPixelBinBp`. Zoomed in this is `1`; once a base falls
         * below half a CSS pixel the encoder samples one per bin.
         */
        get encodeBinBp() {
          return self.settledSubPixelBinBp
        },
      }))
      .views(self => ({
        /**
         * #method
         * Where the rows sit on screen: the row height and the rows' area.
         * Every rows layer reads this one method.
         */
        rowGeometry(): MafRowGeometryParams {
          return {
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
          }
        },
        /**
         * #method
         * The fetch inputs both tiers send through `rpcArgs` and cache under.
         * The focus is a row set since the worker ships only those genomes; the
         * row order is not, since the client places the rows. No
         * fetch-derived state belongs here (`singleFetchPerRegion.test.ts`).
         */
        rpcProps() {
          return {
            rowFocus: self.rowFocusKey,
            interbaseIndicators: self.interbaseIndicatorRule,
          }
        },
      }))
      .views(self => coverageStatsViews(self, mafCoverageSource(self)))
      .views(self => coverageAutoscaleViews(self))
      .views(self => coverageDomainViews(self))
      .views(self =>
        coverageTicksViews(self, () => self.topBands.rects.coverage.height),
      )
      .views(mafCoverageViews)
      .views(mafCoverageHoverViews)
      .views(self => ({
        /**
         * #method
         * Where the rows `[startRow, endRow)` sit in their genomes across
         * the reference bp range `[startBp, endBp)`, the loci an "open this
         * species here" navigation targets. A row contributes nothing with no
         * aligned base in the range, no fetched block covering it, or a genome
         * not loaded as an assembly (`MafRow.assemblyName` unset).
         *
         * Takes the whole row range at once, since the menu builds an entry per
         * row on every open.
         */
        rowNavigationTargets(
          displayedRegionIndex: number,
          startBp: number,
          endBp: number,
          startRow: number,
          endRow: number,
        ) {
          return rowNavigationTargetsOf({
            rows: self.drawnRows,
            assemblies: getSession(self).assemblyManager,
            detail: self.detailOnScreen,
            displayedRegionIndex,
            startBp,
            endBp,
            startRow,
            endRow,
          })
        },
      }))
      .views(mafRowPlanViews)
      .views(mafOverlayViews)
      .views(mafRefNameRankViews)
      .views(mafLegendViews)
      .views(mafRowsEncodeViews)
      .views(mafEncodedUploadViews)
      .views(mafCodonGlyphViews)
      .views(mafHoverViews)
      // #region superMethod
      .views(self => {
        const { trackMenuItems: superTrackMenuItems } = self
        return {
          /**
           * #method
           */
          trackMenuItems() {
            return [
              ...superTrackMenuItems(),
              ...buildMafTrackMenuItems(self),
              ...editPlotMenuItems(self, getCoverageMenuItems(self)),
              ...mafLaunchMenuItems({
                session: getSession(self),
                model: self,
                view: self.view,
                pluginManager: getEnv(self).pluginManager,
              }),
            ]
          },
        }
      })
      // #endregion
      .actions(self => ({
        /**
         * #action
         * The picker Color by's Solid color... opens, on the theme's match
         * tone until a constant is written.
         */
        openSolidColorDialog() {
          const written = self.colorValue
          getDialogHost(self).queueDialog(handleClose => [
            SolidColorDialog,
            {
              label: 'Alignment color',
              color: written ?? self.colorPalette.matchColor,
              written,
              onChange: (color: string) => {
                self.setColorValue(color)
              },
              onReset: () => {
                self.setColorValue(undefined)
              },
              handleClose,
            },
          ])
        },
        /**
         * #action
         * The reference row the last detail batch named — see
         * `refSampleIdVolatile`. Written beside `setSamples` in the batch
         * commit, so a stale batch names nothing.
         */
        setRefSampleId(id: string | undefined) {
          self.refSampleIdVolatile = id
        },
        /**
         * #action
         * Record whether the last frames read was declined as over budget. Set
         * both ways by every fetch pass that reaches the frames adapter, so
         * zooming back in clears it without anything else having to.
         */
        setFramesGateBlocked(blocked: boolean) {
          self.framesGateBlocked = blocked
        },
        /**
         * #action
         * Clears the verdict with the data: it describes a read of the viewport
         * just thrown away, and chromosome nav would otherwise show "too much
         * data" for an unmeasured region.
         */
        clearDisplaySpecificData() {
          self.framesGateBlocked = false
        },
        /**
         * #action
         */
        startRenderingBackend(backend: MafRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.encodedUpload,
            render: (b, encoded) => {
              const hasFetched =
                self.rowsReported ||
                self.hasRegionData ||
                self.coarseTierRead !== undefined
              // One call whatever the rows do: this canvas carries the coverage
              // band too.
              return hasFetched
                ? b.renderBlocks(
                    self.renderBlocks,
                    encoded,
                    self.renderState,
                  ) || !self.rowPlan.perBase
                : false
            },
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The detail fetch. The summary tier's is `fetchCoarseTier` below, and
         * `CoarseTierMixin` suspends this one while the tier is up.
         */
        fetchNeeded(needed: IndexedRegion[]) {
          return fetchMafAlignmentData(self, needed)
        },
        /**
         * #action
         */
        fetchCoarseTier(
          read: CoarseTierRead,
          ctx: FetchContext,
        ): Promise<CoarseTierResult<MafRegionPayload<MafSummaryRecord[]>>> {
          return fetchMafSummaryData(self, read.regions, ctx)
        },
      }))
      .views(() => ({
        /**
         * #getter
         * Enables byte-estimate gating: a MAF-aware estimate (per-species
         * sequence x span) is checked against `fetchSizeLimit` inside the
         * tier's own RPC, blocking the fetch with a force-load prompt.
         *
         * On for both tiers: each RPC measures the file it reads, the alignment
         * index on detail and the `summaryAdapter` sub-adapter on summary
         * (`CoarseTierMixin`), since the summary read is a whole-feature
         * download over every zoom from 20kb up.
         */
        get gateEnabled() {
          return true
        },
      }))
      .actions(self => ({
        // #region renderSvgAction
        /**
         * #action
         * Dynamic import so the export path — and everything it pulls in — stays
         * out of the bundle until someone actually exports.
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
        // #endregion
        afterAttach() {
          // A memo because pointer handlers consume `rpcDataMap`, and MobX
          // discards an unobserved computed's value.
          namedAutorun(
            self,
            () => {
              void self.rpcDataMap
            },
            { name: 'Maf:placedRows' },
          )
          setupTreeSidebarAutoruns(self, {
            name: 'Maf',
            sortRows: (refName, pos) => self.sortRowsByBaseAt(refName, pos),
            clustering: {
              run: async args => {
                const { runMafClustering } =
                  await import('./runMafClustering.ts')
                await runMafClustering({ model: self, ...args })
              },
            },
          })
        },
      }))
  )
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
