import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { radioItems } from '@jbrowse/core/ui/menuItems'
import { getPaletteHost } from '@jbrowse/core/util'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import Flatbush from '@jbrowse/core/util/flatbush'
import { getEnv, types } from '@jbrowse/mobx-state-tree'
import {
  HEIGHT_MULTIPLIERS,
  MIN_FIT_BOX_PX,
  buildFeatureFlatbushIndex,
  computeLaidOutData,
  createContentHeightProbe,
  labelFontSize,
  minDrawnBoxHeight,
  resolveFitLadder,
  scaleLaidOutData,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from '@jbrowse/plugin-canvas'
import { installUpload } from '@jbrowse/render-core/installUpload'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'
import { placeVariantRows } from '../shared/placeVariantRows.ts'
import {
  DEFAULT_VARIANT_LANE_HEIGHT,
  MAX_VARIANT_LANE_HEIGHT,
  MIN_VARIANT_LANE_HEIGHT,
  VARIANT_LANE_BOUNDS,
  VARIANT_LANE_LABEL_OPTIONS,
} from '../shared/variantTopBands.ts'
import { markersForBlock } from './components/drawVariantInsertionGlyphs.ts'
import { drawnCellHeightPx } from './components/shaders/variant.js.generated.ts'
import { exportRCode } from './exportRCode.ts'
import { laneDisplayConfig } from './laneDisplayConfig.ts'
import { buildLaneRenderData } from './laneRenderData.ts'

import type { ShippedRegionData } from '../VariantRPC/executeVariantCellData.ts'
import type { Placed } from '../shared/placeVariantRows.ts'
import type { VariantRenderingBackend } from './components/variantRenderingBackendTypes.ts'
import type { LinearMultiSampleVariantDisplayConfigModel } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  FeatureDataResult,
  FlatbushRegionIndexes,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
  ShowLabelsMode,
} from '@jbrowse/plugin-canvas'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

/**
 * The unscaled height a lane mark is packed at, before the fit ladder scales the
 * kept stack to fill the band.
 *
 * plugin-canvas's own `featureHeight` default, so a lane mark and the same record
 * in a `LinearVariantDisplay` start from one number — the band's compactness
 * comes from the display mode and the fit, not from a second height.
 */
const LANE_FEATURE_HEIGHT = 10

/**
 * The lane packs in `compact`, which is what makes it a band rather than a track:
 * bodies at 0.6x and label text shrunk to match, so a 40px band holds two
 * labeled rows where `normal` holds one. It is also what gives the fit ladder
 * room to GROW a sparse window — `fitMaxScale` is `1 / 0.6`, so a handful of
 * records fills the band at up to normal size instead of leaving it empty.
 */
const LANE_DISPLAY_MODE = 'compact' as const

/** No pins in a band: the feature there is the display's, not the lane's. */
const NO_PINNED_FEATURES: ReadonlySet<string> = new Set()

/**
 * #stateModel LinearMultiSampleVariantDisplay
 * Multi-sample variant display drawing one genotype row per sample, with a
 * per-cell feature widget on click.
 */
export function stateModelFactory(
  configSchema: LinearMultiSampleVariantDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearMultiSampleVariantDisplay',
        MultiSampleVariantBaseModelF(configSchema, 'regular'),
        types.model({
          type: types.literal('LinearMultiSampleVariantDisplay'),
          // Same node the base already holds — the base declares
          // `configuration` off a param typed to the *shared* schema, so a slot
          // this display owns alone (showInsertionGlyphs) would be invisible to
          // `getConf`. Redeclaring here overrides the prop's type with the
          // concrete schema (`types.compose` overrides props, it does not
          // intersect them), so own-slot reads narrow. Runtime value is
          // identical: `configSchema` is this display's schema either way.
          configuration: ConfigurationReference(configSchema),
        }),
      )
      // Remap the old type literal on active (view-level) display instances. The
      // DisplayType `aliases` only covers the track *config*; the view's display
      // union dispatches on the raw `type`, so it needs this rewrite too.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        snap?.type === 'MultiLinearVariantDisplay'
          ? { ...snap, type: 'LinearMultiSampleVariantDisplay' }
          : snap,
      )
      .actions(self => ({
        /**
         * #action
         * Switch the variant lane on or off. The rows resize with it —
         * `availableHeight` subtracts the band — which is the point: the lane
         * takes its space from the plot rather than growing the track.
         */
        setShowVariantLane(arg: boolean) {
          setConf(self, 'showVariantLane', arg)
        },
        /**
         * #action
         * Resize the variant lane, clamped. Clamped in the setter rather than
         * at read time for the same reason `setLineZoneHeight` is: a drag can
         * deliver any number, and a band dragged shut has to stay grabbable.
         */
        setVariantLaneHeight(arg: number) {
          setConf(
            self,
            'variantLaneHeight',
            clampBandHeight(self.variantLaneHeight, arg, VARIANT_LANE_BOUNDS),
          )
        },
        /**
         * #action
         */
        setVariantLaneLabels(arg: ShowLabelsMode) {
          setConf(self, 'variantLaneLabels', arg)
        },
      }))
      .views(self => {
        const {
          showSubmenuItems: superShowSubmenuItems,
          trackMenuItems: superTrackMenuItems,
          rpcProps: superRpcProps,
        } = self

        return {
          // The base declares these `false`/default and this display overrides
          // them, because the slots are on *this* schema: the band geometry is
          // shared (every display's rows sit under whatever is stacked on them)
          // but a display that reserved a lane it cannot paint would take the
          // height from its rows and leave it blank. See the slot docs.
          get showVariantLane(): boolean {
            return getConf(self, 'showVariantLane')
          },
          get variantLaneHeight(): number {
            return getConf(self, 'variantLaneHeight')
          },
          get variantLaneLabels(): ShowLabelsMode {
            return getConf(self, 'variantLaneLabels')
          },
          /**
           * #getter
           * Whether an insertion is drawn wider than the reference span it
           * consumes — a marker sized by the inserted bp — or at the 2px floor
           * like a SNP.
           *
           * A getter and not three `getConf` calls, because it is the answer
           * *three* separate pieces of geometry need and they must give the same
           * one: the marker overlay, the cells' hover highlight, and their click
           * target. All three read it through `variantCellSpanPx`, which is where
           * the invariant is written down.
           *
           * It used to be four — the variant lane's marks were the fourth. They
           * are plugin-canvas boxes now, and a box there is its reference span,
           * so the band does not widen an insertion at all; the length lives in
           * the rows' markers alone.
           */
          get showInsertionGlyphs(): boolean {
            return getConf(self, 'showInsertionGlyphs')
          },
          get visibleRegions() {
            const view = self.host
            return view.visibleRegions
          },
          // Resolved geometry, never undefined. "The view isn't measured yet" is
          // the mixin-wide `canRender` gate, and "no regular-mode payload" falls
          // out of an empty perRegionCellMap — neither is a nullable state.
          get renderState() {
            return {
              canvasWidth: self.canvasWidthPx,
              canvasHeight: self.availableHeight,
              rowHeight: self.effectiveRowHeight,
              scrollTop: self.scrollTop,
            }
          },
          // referenceDrawingMode is a fetch input here and only here:
          // computeVariantCells omits reference cells entirely when it is
          // 'skip', so the shipped payload differs. The matrix keeps it out of
          // rpcProps because it always computes ref cells and greys the
          // background in CSS — listing it there refetched identical bytes
          // whenever PORTABLE_CONFIG_KEYS carried the slot across a
          // display-type switch.
          rpcProps() {
            return {
              ...superRpcProps(),
              referenceDrawingMode: self.referenceDrawingMode,
            }
          },
          trackMenuItems(): MenuItem[] {
            const items = superTrackMenuItems()
            // Only offered while the lane is on: a slider that silently does
            // nothing is worse than an absent one, and the checkbox that turns
            // it on is in the "Show..." submenu at the head of the same menu.
            return self.showVariantLane
              ? [
                  ...items,
                  makeSizeMenu({
                    label: 'Variant lane height',
                    title: 'Variant lane height',
                    min: MIN_VARIANT_LANE_HEIGHT,
                    // the clamp's own ceiling, so the slider stops exactly
                    // where `setVariantLaneHeight` would stop it
                    max: MAX_VARIANT_LANE_HEIGHT,
                    step: 1,
                    // Pure layout — no refetch and no re-upload, only a band
                    // resize — so it tracks the drag rather than waiting for
                    // release the way the fetch-input filter sliders do.
                    getValue: () => self.topBands.laneHeight,
                    isDefault:
                      self.variantLaneHeight === DEFAULT_VARIANT_LANE_HEIGHT,
                    onChange: n => {
                      self.setVariantLaneHeight(n)
                    },
                    onReset: () => {
                      self.setVariantLaneHeight(DEFAULT_VARIANT_LANE_HEIGHT)
                    },
                  }),
                ]
              : items
          },
          showSubmenuItems() {
            return [
              ...superShowSubmenuItems(),
              {
                label: 'Show variant lane',
                helpText:
                  'Draw the variants themselves in a lane above the genotype rows, at their genomic positions and in whatever "Color by → Cells" is set to — the relationship the coverage band has to a pileup. The lane takes its height from the rows rather than growing the track',
                type: 'checkbox',
                checked: self.showVariantLane,
                onClick: () => {
                  self.setShowVariantLane(!self.showVariantLane)
                },
              },
              // plugin-canvas's own five choices under its own names, so a
              // reader who has set this on a variant track finds the same menu
              // here. Only offered while the lane is on.
              ...(self.showVariantLane
                ? [
                    {
                      label: 'Variant lane labels',
                      helpText:
                        'Which text is drawn under each mark. The lane is one row, so a label is drawn only where it clears the previous one — they thin out as you zoom out, and a line is dropped when the lane is too short to hold the mark and the text',
                      subMenu: radioItems(
                        VARIANT_LANE_LABEL_OPTIONS,
                        self.variantLaneLabels,
                        mode => {
                          self.setVariantLaneLabels(mode)
                        },
                      ),
                    },
                  ]
                : []),
              {
                label: 'Show reference alleles',
                helpText:
                  'When this setting is off, the background is colored solid grey and only ALT alleles are colored on top of it. This makes it easier to see potentially overlapping structural variants',
                type: 'checkbox',
                checked: self.referenceDrawingMode !== 'skip',
                onClick: () => {
                  self.setReferenceDrawingMode(
                    self.referenceDrawingMode === 'skip' ? 'draw' : 'skip',
                  )
                },
              },
            ]
          },
        }
      })
      .views(self => ({
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * The one walk of `perRegionCellData`, and the point where a fetched
         * cell becomes a *placed* cell. Every regular-mode consumer reads this
         * map, so "does the glyph overlay see the same regions, and the same
         * rows, as the canvas" has a single answer — the placed payload
         * structurally satisfies `VariantUploadData` (GPU/Canvas upload) and
         * `VariantInsertionGlyphData` (overlay), and carries `featureIndexData`
         * for the hit-test index plus `cellWorkerRowIndices` for its lookup.
         *
         * This is the display's "derived region map" in the sense of
         * ARCHITECTURE.md's re-upload-without-refetch pattern: the arrays are
         * freshly allocated per region and never mutated in place, so a row
         * reorder changes each entry's identity, `createRegionUploadSync` sees
         * the change and re-uploads, and no RPC is involved. Rows are the only
         * thing derived here — the worker's numbering is arbitrary and must not
         * reach a painter.
         *
         * A computed returning a plain Map, for the same reason the multi-row
         * display's is: the overlay draws inside an effect, where nothing it
         * reads is tracked, so the read has to happen here for a refetch to
         * repaint. Rebuilding is cheap (typical view shows 1-3 regions); MobX
         * caches the computed so only cellData or a reorder invalidates it.
         */
        get perRegionCellMap() {
          const { cellData, rowRemap } = self
          const out = new Map<number, Placed<ShippedRegionData>>()
          // No rowRemap means no data has landed: an empty map is the same
          // "nothing to draw" every consumer already handles. Never fall back to
          // identity placement — the worker's row order is its own.
          if (cellData?.mode === 'regular' && rowRemap) {
            for (const k in cellData.perRegionCellData) {
              out.set(
                Number(k),
                placeVariantRows(cellData.perRegionCellData[k]!, rowRemap),
              )
            }
          }
          return out
        },
      }))
      // separate block so these see perRegionCellMap
      .views(self => ({
        /**
         * #getter
         * Per-region cell data for the insertion-glyph overlay, or undefined
         * when the slot is off.
         */
        get insertionGlyphRegions() {
          return self.showInsertionGlyphs ? self.perRegionCellMap : undefined
        },
        /**
         * #getter
         * Per-region data for the variant lane, or undefined when the band is
         * off. The same `perRegionCellMap` the canvas and the glyph overlay
         * read, so the lane cannot see a different region set — or a different
         * row placement — than the cells under it. The lane itself only touches
         * the per-*feature* arrays in there.
         */
        get variantLaneRegions() {
          return self.topBands.laneHeight > 0
            ? self.perRegionCellMap
            : undefined
        },
        /**
         * #getter
         * Overrides the base's `undefined`: this display draws the markers, so
         * it is the one that puts them in the legend. `getPaletteHost(self).palette`
         * rather than a React theme, because this is a model getter — and it is
         * the same `palette.insertion` the on-screen overlay paints with (via
         * `usePalette`), so the swatch cannot drift from the glyph there. The
         * SVG export paints with the *export* theme's palette instead, and
         * passes it to `legendSections` so the swatch follows it too.
         *
         * The condition is `markersForBlock` — the painter's own test, on the
         * painter's own blocks — because both cheaper approximations are wrong
         * on real figures. "The window holds an insertion" puts a swatch on a
         * callset of short indels, which can never draw a marker at any zoom.
         * "The window holds a *long* insertion" puts one on any view zoomed out
         * far enough that even a long bar falls under the 2px cell floor; that
         * was three of the fourteen committed figures carrying this display,
         * each gaining exactly one 576px swatch and no glyph.
         *
         * So the entry does come and go with zoom, unlike `hasSecondaryAlt` /
         * `hasNoCall`. That is the honest behavior for a glyph whose visibility
         * is itself a function of zoom, and it is why this reads the view: the
         * components that call `legendSections` are the same ones that already
         * read `renderState`.
         */
        get insertionLegendColor(): string | undefined {
          if (!self.showInsertionGlyphs) {
            return undefined
          }
          const { rowHeight, canvasWidth } = self.renderState
          const drawnRowHeight = drawnCellHeightPx(rowHeight)
          for (const block of self.renderBlocks) {
            const region = self.perRegionCellMap.get(block.displayedRegionIndex)
            if (
              region?.numCells &&
              markersForBlock(region, block, drawnRowHeight, canvasWidth)
                .anyMarker
            ) {
              return getPaletteHost(self).palette.insertion
            }
          }
          return undefined
        },
        /**
         * #getter
         * Per-region spatial index over feature intervals, for the hit-test. One
         * entry per variant, not per cell — see computeVariantCells.
         */
        get featureIndices() {
          const out = new Map<number, Flatbush>()
          for (const [regionIdx, region] of self.perRegionCellMap) {
            out.set(regionIdx, Flatbush.from(region.featureIndexData))
          }
          return out
        },
        /**
         * #getter
         * The plugin-canvas display config the lane's band is laid out with. See
         * `laneDisplayConfig` — a literal, because a band has no config schema.
         */
        get laneDisplayConfig() {
          return laneDisplayConfig({
            labels: self.variantLaneLabels,
            featureHeight: LANE_FEATURE_HEIGHT,
          })
        },
        /**
         * #getter
         * The label size the lane's marks are lettered at — plugin-canvas's, for
         * the lane's display mode, so the width its packer reserved is the width
         * the text draws at.
         */
        get laneFontSize() {
          return labelFontSize(LANE_DISPLAY_MODE)
        },
        /**
         * #method
         * The record behind a lane mark, by feature id. plugin-canvas's hit test
         * answers with an id (its payload carries no VCF fields), and the tooltip
         * and the click both want the record — so this is the one place that
         * crosses back, over `featureGenotypeMap`, the same map the genotype
         * cells' hit test reads.
         */
        laneFeatureInfo(featureId: string) {
          for (const region of self.perRegionCellMap.values()) {
            const info = region.featureGenotypeMap[featureId]
            if (info) {
              return info
            }
          }
          return undefined
        },
      }))
      // separate block so the lane chain reads its siblings off `self`
      .views(self => ({
        /**
         * #getter
         * The lane's marks as plugin-canvas render data, one entry per visible
         * region — the payload that display's own RPC produces, built here from
         * records this display already parsed. Empty when the band is off, which
         * is what stops every getter below it from doing any work.
         *
         * See `buildLaneRenderData` for why this is main-thread and costs no
         * second fetch. A MobX computed, so it is rebuilt when the payload or
         * the label mode changes and not per frame — and the entries' identity
         * changing is what lets the packer below re-pack.
         */
        get laneRenderDataMap(): ReadonlyMap<number, LayoutRegionData> {
          const out = new Map<number, LayoutRegionData>()
          // `canRender` is the mixin's "the view is measured" answer, the same
          // gate this display's render lifecycle takes — plugin-canvas's
          // `layoutReady` for the same reason. Without it every getter below
          // reads `visibleRegions` before the view has blocks.
          if (self.canRender && self.topBands.laneHeight > 0) {
            const config = self.laneDisplayConfig
            const { jexl } = getEnv<{ pluginManager: PluginManager }>(
              self,
            ).pluginManager
            for (const region of self.visibleRegions) {
              const data = self.perRegionCellMap.get(
                region.displayedRegionIndex,
              )
              if (data?.featureIdList.length) {
                out.set(
                  region.displayedRegionIndex,
                  buildLaneRenderData({ data, region, config, jexl }),
                )
              }
            }
          }
          return out
        },
        /**
         * #getter
         * What the lane's packer reads, minus the label reservation each fit rung
         * varies. One source, so the rungs cannot drift on zoom or orientation.
         *
         * `coarseBpPerPx`, the 500ms-debounced one, for the reason
         * `LinearBasicDisplay` uses it: row packing must not recompute on every
         * frame of a smooth zoom.
         */
        get laneLayoutInputs(): Omit<
          LayoutInputs,
          'showLabels' | 'showDescriptions'
        > {
          const reversedRegions = new Set<number>()
          for (const region of self.visibleRegions) {
            if (region.reversed) {
              reversedRegions.add(region.displayedRegionIndex)
            }
          }
          return {
            bpPerPx: self.view.coarseBpPerPx,
            reversedRegions,
            displayMode: LANE_DISPLAY_MODE,
            pinnedFeatureIds: NO_PINNED_FEATURES,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * One fit candidate: the lane's stack packed with the given label
         * reservation. plugin-canvas's packer, so overlapping SVs stack instead
         * of overdrawing, a label is placed by the layout that reserved room for
         * it, and paint order is the order the hit test resolves by.
         *
         * Non-incremental, unlike that display's four memos: those exist so a
         * GPU upload diff stays small across a pan over a stack of hundreds of
         * thousands of features. A band holds thousands and repaints whole.
         */
        laneLayoutAt(
          showLabels: boolean,
          showDescriptions: boolean,
        ): Map<number, FeatureDataResult> {
          return computeLaidOutData(self.laneRenderDataMap, {
            ...self.laneLayoutInputs,
            showLabels,
            showDescriptions,
          })
        },
        /**
         * #getter
         * Inputs for the `decimated` rung, whose whitespace factor is solved
         * against the band height. Descriptions are already gone by that rung.
         */
        get laneDecimatedInputs(): LabelRoomFactorFreeInputs {
          return {
            ...self.laneLayoutInputs,
            showLabels: self.topBands.wantsName,
            showDescriptions: false,
            labelDecimation: 'fitWidth',
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The rung the lane keeps and the scale that fills the band with it —
         * plugin-canvas's fit ladder, run against `laneHeight` instead of a track
         * height. Names and descriptions if they fit; else descriptions dropped;
         * else names kept only where they have room; else bodies alone, squeezed
         * and scrolled-off if even that overflows.
         *
         * This is the whole of "compact": the band never grows, so what adapts is
         * how much of each record the band spends its pixels on — which is the
         * question `LinearVariantDisplay` in fit mode already answers.
         */
        get laneFitStage() {
          const bodies = () => self.laneLayoutAt(false, false)
          const full = self.laneLayoutAt(
            self.topBands.wantsName,
            self.topBands.wantsDescription,
          )
          const labelsOnly = () =>
            self.topBands.wantsDescription
              ? self.laneLayoutAt(self.topBands.wantsName, false)
              : full
          const decimated = () => {
            // The solve and the commit pack through one builder, so the stack
            // measured cannot differ from the stack kept — plugin-canvas's rule,
            // and the reason its own probe is a getter.
            const factor = self.topBands.wantsName
              ? solveLabelRoomFactor(
                  createContentHeightProbe(
                    self.laneRenderDataMap,
                    self.laneDecimatedInputs,
                  ),
                  self.topBands.laneHeight,
                )
              : undefined
            return factor === undefined
              ? labelsOnly()
              : computeLaidOutData(self.laneRenderDataMap, {
                  ...self.laneDecimatedInputs,
                  labelRoomFactor: factor,
                })
          }
          const shortestBox = minDrawnBoxHeight(full)
          return resolveFitLadder(
            [
              { level: 'full', layout: () => full },
              { level: 'labels', layout: labelsOnly },
              { level: 'decimated', layout: decimated },
              { level: 'bodies', layout: bodies },
            ],
            self.topBands.laneHeight,
            // the same floor a track's squeeze bottoms out at, and the same one
            // every variant painter here already draws to (`variantCellSpanPx`)
            squeezeFloorScale(shortestBox, MIN_FIT_BOX_PX),
            // the grow ceiling is the display mode's compact ratio inverted, as
            // `fitMaxScale` spells it — a sparse band fills up to normal feature
            // height and no further
            1 / HEIGHT_MULTIPLIERS[LANE_DISPLAY_MODE],
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * What the lane's painter, its labels and its hit test all read: the
         * resolved stack, scaled only when the fit grew or squeezed it.
         */
        get laneLaidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
          const { layout, scale } = self.laneFitStage
          return scale === 1 ? layout : scaleLaidOutData(layout, scale)
        },
        /**
         * #getter
         * The band's own drawn height — the kept rung's stack, scaled. Less than
         * `laneHeight` on a sparse window (the surplus is bottom whitespace, so a
         * relayout packs back against the top rather than jumping to a re-centred
         * offset) and equal to it whenever the fit had to work.
         */
        get laneContentHeight() {
          const { contentHeight, scale } = self.laneFitStage
          return Math.min(self.topBands.laneHeight, contentHeight * scale)
        },
        /**
         * #getter
         * Which label kinds the lane actually paints. The mode asked for them;
         * the rung that survived decides — a box must never reserve width for a
         * description the band had no room to draw.
         */
        get laneRenderedLabels() {
          const { level } = self.laneFitStage
          return {
            showLabels: self.topBands.wantsName && level !== 'bodies',
            showDescriptions:
              self.topBands.wantsDescription && level === 'full',
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-region hit index over the lane's laid-out marks — plugin-canvas's,
         * built off the same stack it painted, so the box under the cursor is the
         * box the pick returns. Its label overhang is part of the hit box there,
         * which is why this reads the RENDERED label flags and not the mode's.
         */
        get laneFlatbushIndexes() {
          const { showLabels, showDescriptions } = self.laneRenderedLabels
          const out = new Map<number, FlatbushRegionIndexes>()
          for (const region of self.visibleRegions) {
            const data = self.laneLaidOutDataMap.get(
              region.displayedRegionIndex,
            )
            if (data) {
              out.set(region.displayedRegionIndex, {
                feature: buildFeatureFlatbushIndex(
                  data.flatbushItems,
                  data.floatingLabelsData,
                  (region.end - region.start) /
                    (region.screenEndPx - region.screenStartPx),
                  !!region.reversed,
                  { showLabels, showDescriptions, fontSize: self.laneFontSize },
                ),
                // A VCF record has no subfeatures, so `layoutBox` emits none and
                // there is no second index to search.
                subfeature: null,
              })
            }
          }
          return out
        },
      }))
      // separate block so renderSvg's `self` sees perRegionCellMap/renderBlocks
      // and insertionGlyphRegions
      .views(self => ({
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
        // explicit return type breaks the self-referential MST model-type cycle
        // (same trick as renderSvg); builds the R panel for this track
        exportRCode(): RTrackFragment | undefined {
          return exportRCode(self as LinearMultiSampleVariantDisplayModel)
        },
      }))
      .actions(self => ({
        startRenderingBackend(backend: VariantRenderingBackend) {
          // `perRegionCellMap` is one MobX computed and its entries are the
          // upload payload, so the encode is the identity and there is nothing
          // to declare `inputs` for.
          installUpload(self, backend, {
            cells: () => self.perRegionCellMap,
            render: b =>
              b.renderBlocks(
                self.renderBlocks,
                self.perRegionCellMap,
                self.renderState,
              ),
          })
        },
      }))
  )
}

export type LinearMultiSampleVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiSampleVariantDisplayModel =
  Instance<LinearMultiSampleVariantDisplayStateModel>

export default stateModelFactory
