import { getConf, setConf } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { radioItems } from '@jbrowse/core/ui/menuItems'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import Flatbush from '@jbrowse/core/util/flatbush'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
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
import {
  makeBpMapper,
  pxPerBpOf,
  spanRect,
} from '@jbrowse/render-core/canvas2dUtils'
import { installUpload, oneCell } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'
import {
  MULTI_SAMPLE_VARIANT_DISPLAY,
  clampLineZoneHeight,
} from '../shared/constants.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { placeVariantRows } from '../shared/placeVariantRows.ts'
import {
  DEFAULT_VARIANT_LANE_HEIGHT,
  MAX_VARIANT_LANE_HEIGHT,
  MIN_VARIANT_LANE_HEIGHT,
  VARIANT_LANE_BOUNDS,
  VARIANT_LANE_LABEL_OPTIONS,
} from '../shared/variantTopBands.ts'
import { anyMarkerPossibleForBlock } from './components/drawVariantInsertionGlyphs.ts'
import { drawnCellHeightPx } from './components/shaders/variant.js.generated.ts'
import { variantCellSpanPx } from './components/variantCellSpan.ts'
import { VARIANT_MARKS } from './components/variantMarks.ts'
import { laneDisplayConfig } from './laneDisplayConfig.ts'
import { buildLaneRenderData } from './laneRenderData.ts'
import { VARIANT_MATRIX_MARKS } from './matrix/variantMatrixMarks.ts'

import type { ShippedRegionData } from '../VariantRPC/executeVariantCellData.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { Placed } from '../shared/placeVariantRows.ts'
import type { HoveredCell } from './components/VariantComponent.tsx'
import type { VariantRenderingBackend } from './components/variantRenderingBackendTypes.ts'
import type { LinearMultiSampleVariantDisplayConfigModel } from './configSchema.ts'
import type { MatrixHoveredCell } from './matrix/VariantMatrixComponent.tsx'
import type {
  VariantMatrixRenderBlock,
  VariantMatrixRenderingBackend,
  VariantMatrixUploadData,
} from './matrix/variantMatrixRenderingBackendTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  FeatureDataResult,
  FlatbushRegionIndexes,
  HitFeatureResult,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
  ShowLabelsMode,
} from '@jbrowse/plugin-canvas'

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
 * The lane packs in `compact`, with bodies at 0.6x and label text shrunk to
 * match, so a 40px band holds two labeled rows where `normal` holds one.
 * `compact` also gives the fit ladder room to GROW a sparse window: the lane's
 * grow ceiling is `1 / 0.6`, so a handful of records fills the band at up to
 * normal size.
 */
const LANE_DISPLAY_MODE = 'compact' as const

/** No pins in a band: the feature there is the display's, not the lane's. */
const NO_PINNED_FEATURES: ReadonlySet<string> = new Set()

const VARIANT_LAYOUT_OPTIONS = [
  {
    value: 'genomic' as const,
    label: 'At genomic positions',
    helpText:
      'Draw each variant across the bases it covers, so a deletion reads as long as it is and variants a few bases apart share pixels when zoomed out',
  },
  {
    value: 'columns' as const,
    label: 'Equal-width columns',
    helpText:
      'Draw one equal-width column per variant in view, with a line tying each column to its position. Keeps the genotype pattern across dense variants readable at any zoom, at the cost of their lengths',
  },
]

type PlacedMatrixData = Placed<
  VariantMatrixUploadData & { refCellCount: number }
>

/**
 * The GPU program each layout draws with, tagged so the one upload lifecycle
 * sends each payload to the backend that can draw it.
 */
export type VariantLayoutBackend =
  | (VariantRenderingBackend & { columns: false })
  | (VariantMatrixRenderingBackend & { columns: true })

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
        MULTI_SAMPLE_VARIANT_DISPLAY,
        MultiSampleVariantBaseModelF(configSchema),
        types.model({
          type: types.literal(MULTI_SAMPLE_VARIANT_DISPLAY),
        }),
      )
      .volatile(() => ({
        /**
         * #volatile
         * The genotype cell under the pointer, as `hoverInk` lights it.
         * Beside the base's `hoveredFeature` (the tooltip) rather than folded
         * into it: the tooltip is the shared cross-display slot, and the box
         * needs the cell's instance that slot has no reason to carry.
         */
        hoveredCell: undefined as HoveredCell | undefined,
        /**
         * #volatile
         * The lane mark under the pointer — plugin-canvas's own hit, so
         * `hoverInk` lands on the box the lane painted.
         */
        hoveredLaneMark: undefined as HitFeatureResult | undefined,
        /**
         * #volatile
         * The matrix cell under the pointer, in the equal-width column layout.
         */
        hoveredMatrixCell: undefined as MatrixHoveredCell | undefined,
        /**
         * #volatile
         * Whether the attached backend draws columns, so the upload sends it
         * the payload it can draw across the swap a layout change makes.
         */
        backendDrawsColumns: false,
      }))
      .actions(self => {
        const { clearHoveredFeature: superClearHoveredFeature } = self
        return {
          /**
           * #action
           */
          setHoveredCell(cell?: HoveredCell) {
            self.hoveredCell = cell
          },
          /**
           * #action
           */
          setHoveredLaneMark(mark?: HitFeatureResult) {
            self.hoveredLaneMark = mark
          },
          /**
           * #action
           */
          setHoveredMatrixCell(cell?: MatrixHoveredCell) {
            self.hoveredMatrixCell = cell
          },
          /**
           * #action
           * The base clears the tooltip; the two highlight boxes go with it.
           */
          clearHoveredFeature() {
            superClearHoveredFeature()
            self.hoveredCell = undefined
            self.hoveredLaneMark = undefined
            self.hoveredMatrixCell = undefined
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         * Switch the variant lane on or off. The rows resize with it, because
         * `availableHeight` subtracts the band, so the lane takes its space
         * from the plot and the track keeps its height.
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
        /**
         * #action
         */
        setVariantLayout(arg: 'genomic' | 'columns') {
          setConf(self, 'variantLayout', arg)
          // the other layout mounts a backend of its own; a failure of this
          // one's must not keep the banner up in its place
          self.setRenderError(undefined)
        },
        /**
         * #action
         */
        setLineZoneHeight(n: number) {
          setConf(
            self,
            'lineZoneHeight',
            clampLineZoneHeight(self.lineZoneHeight, n),
          )
        },
        /**
         * #action
         */
        setBackendDrawsColumns(arg: boolean) {
          self.backendDrawsColumns = arg
        },
      }))
      .views(self => ({
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
        /**
         * #getter
         * The width the columns are laid out in: the rounded **content**
         * width, so they still fill the drawn matrix when the genome doesn't
         * reach across the viewport. Not `canvasWidthPx`, the viewport box a
         * span maps bp into — the LD display's triangle takes the same width
         * for the same reason.
         */
        get matrixWidth() {
          return self.view.totalWidthPxWithoutBorders
        },
      }))
      .views(self => {
        const { trackMenuItems: superTrackMenuItems, rpcProps: superRpcProps } =
          self
        return {
          // Resolved geometry, never undefined. "The view isn't measured yet" is
          // the mixin-wide `canRender` gate, and "no payload" falls out of an
          // empty cell map — neither is a nullable state.
          get renderState() {
            return {
              canvasWidth: self.atGenomicPositions
                ? self.canvasWidthPx
                : self.matrixWidth,
              canvasHeight: self.availableHeight,
              rowHeight: self.effectiveRowHeight,
              scrollTop: self.scrollTop,
            }
          },
          // A fetch input at genomic positions only, where the worker leaves
          // reference cells out under 'skip'. Columns always carry them and
          // grey the background instead, so a toggle there refetches nothing.
          rpcProps() {
            return {
              ...superRpcProps(),
              referenceDrawingMode: self.atGenomicPositions
                ? self.referenceDrawingMode
                : undefined,
            }
          },
          trackMenuItems(): MenuItem[] {
            const items = [
              ...superTrackMenuItems(),
              {
                label: 'Variant layout',
                subMenu: radioItems(
                  VARIANT_LAYOUT_OPTIONS,
                  self.variantLayout,
                  layout => {
                    self.setVariantLayout(layout)
                  },
                ),
              },
            ]
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
        }
      })
      .views(self => {
        const { showSubmenuItems: superShowSubmenuItems } = self
        return {
          showSubmenuItems() {
            if (!self.atGenomicPositions) {
              return superShowSubmenuItems()
            }
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
            ]
          },
        }
      })
      .views(self => ({
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
      .views(self => ({
        /**
         * #getter
         * The column layout's payload with its rows placed on screen, the
         * counterpart of `perRegionCellMap`.
         */
        get placedMatrixData(): PlacedMatrixData | undefined {
          const { cellData, rowRemap } = self
          return cellData?.mode === 'matrix' && rowRemap
            ? placeVariantRows(cellData, rowRemap)
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The columns as the mark backend's region map: one payload under key
         * 0, left out while it has no cells so the backend answers "nothing
         * drawn" and the loading scrim stays over a blank canvas.
         */
        get matrixRegions(): ReadonlyMap<number, VariantMatrixUploadData> {
          const data = self.placedMatrixData
          return oneCell(0, data?.numCells ? data : undefined)
        },
        /**
         * #getter
         * The one block the column layout draws: the whole canvas, spanning
         * the column indices, the payload's `numFeatures` carrying the pitch.
         */
        get matrixBlocks(): VariantMatrixRenderBlock[] {
          return [
            {
              displayedRegionIndex: 0,
              start: 0,
              end: self.placedMatrixData?.numFeatures ?? 0,
              screenStartPx: 0,
              screenEndPx: self.matrixWidth,
              reversed: false,
            },
          ]
        },
        /**
         * #getter
         * Column pitch and origin in viewport pixels: `left` is where the
         * content starts when it doesn't reach the left viewport edge. The
         * connector lines, their hit test and the crosshair column all key off
         * this, so columns, lines and clicks stay pixel-aligned.
         */
        get columnGeometry() {
          const n = self.cellData?.simplifiedFeatures.length ?? 0
          return {
            n,
            columnWidth: n ? self.matrixWidth / n : 0,
            left: Math.max(0, -self.host.offsetPx),
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * One connector per column, **by column**, in viewport pixels: `mx`
         * the column centre, `gx` the variant's position on the ruler,
         * `label` what the hover tooltip shows. `undefined` where the variant's
         * refName has left the view. Indexed rather than filtered, so the
         * crosshair can ask of one column what the drawn field asks of all.
         * Column and data index are one number: the worker ships the variants
         * in screen order.
         */
        get connectorCoordsByColumn(): (ConnectorCoord | undefined)[] {
          const features = self.cellData?.simplifiedFeatures
          if (!features) {
            return []
          }
          const locusX = locusViewportXFor(self)
          const { columnWidth, left } = self.columnGeometry
          return features.map(({ data }, i) => {
            const gx = locusX(String(data.refName), Number(data.start))
            return gx === undefined
              ? undefined
              : {
                  mx: left + (i + 0.5) * columnWidth,
                  gx,
                  label: data.name as string | undefined,
                }
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The connector lines that draw: those with a genomic x.
         */
        get connectorLineCoords(): ConnectorCoord[] {
          return self.connectorCoordsByColumn.filter(
            coord => coord !== undefined,
          )
        },
        /**
         * #method
         * The connector for the column under `screenX` (the crosshair), or
         * undefined off the ends and over a column with no genomic x.
         */
        connectorLineAtScreenX(screenX: number): ConnectorCoord | undefined {
          const { n, columnWidth, left } = self.columnGeometry
          const screenCol = Math.floor((screenX - left) / columnWidth)
          return screenCol >= 0 && screenCol < n
            ? self.connectorCoordsByColumn[screenCol]
            : undefined
        },
      }))
      // separate block so these see perRegionCellMap
      .views(self => ({
        /**
         * #getter
         * The box of the hovered genotype cell or lane mark, for the
         * chrome's highlight. A cell is its instance through the cell mark's
         * ink, moved down by the bands above the rows, and widened to the
         * insertion marker where one paints over it; a lane mark is the box
         * plugin-canvas laid out and painted, in the lane at the top.
         */
        get hoverInk(): HighlightRect[] {
          const {
            hoveredCell: cell,
            hoveredLaneMark: lane,
            hoveredMatrixCell: matrixCell,
          } = self
          if (matrixCell) {
            const { left } = self.columnGeometry
            const top = self.rowsTopOffset
            return inkOfInstances(
              VARIANT_MATRIX_MARKS,
              self.matrixBlocks,
              index => self.matrixRegions.get(index),
              self.renderState,
              () => [{ mark: 0, index: matrixCell.cellIndex }],
            ).map(r => ({ ...r, left: r.left + left, top: r.top + top }))
          }
          if (cell) {
            const region = self.renderBlocks.find(
              b => b.displayedRegionIndex === cell.displayedRegionIndex,
            )
            const [ink] = inkOfInstances(
              VARIANT_MARKS,
              self.renderBlocks,
              idx => self.perRegionCellMap.get(idx),
              self.renderState,
              idx =>
                idx === cell.displayedRegionIndex
                  ? [{ mark: 0, index: cell.cellIndex }]
                  : undefined,
            )
            if (!ink || !region) {
              return []
            }
            const toX = makeBpMapper(region)
            const marker = variantCellSpanPx({
              x1: toX(cell.genomicStart),
              x2: toX(cell.genomicEnd),
              canvasWidth: self.canvasWidthPx,
              insertedBp: cell.insertedBp,
              insertionsWiden: self.showInsertionGlyphs,
              pxPerBp: pxPerBpOf(region),
              drawnRowHeight: ink.height,
            })
            return [
              {
                ...ink,
                ...(marker.drawsMarker
                  ? { left: marker.left, width: marker.width }
                  : {}),
                top: ink.top + self.rowsTopOffset,
              },
            ]
          }
          if (lane) {
            const region = self.visibleRegions.find(
              r => r.displayedRegionIndex === lane.displayedRegionIndex,
            )
            if (!region) {
              return []
            }
            const { feature } = lane
            const { left, width } = spanRect(
              makeBpMapper(region),
              feature.startBp,
              feature.endBp,
              1,
            )
            return [
              {
                left,
                top: feature.topPx,
                width,
                height: feature.bottomPx - feature.topPx,
              },
            ]
          }
          return []
        },
        /**
         * #getter
         * A wash and a border: the cell colours are the data.
         */
        get highlightStyle(): HighlightStyle {
          return 'box'
        },
        /**
         * #getter
         * Per-region cell data for the insertion-glyph overlay, or undefined
         * when no marker can draw in this window, which unmounts the overlay
         * rather than repainting it empty on every pan frame.
         */
        get insertionGlyphRegions() {
          return this.drawsInsertionMarkers ? self.perRegionCellMap : undefined
        },
        /**
         * #getter
         * Overrides the base's `false`: this display draws the markers, so it
         * is the one that puts them in the legend.
         *
         * The condition is `anyMarkerPossibleForBlock`, on the painter's own
         * blocks, because the two cheaper approximations are wrong on real
         * figures. "The window holds an insertion" puts the entry on a callset
         * of short indels, which can never draw a marker at any zoom. "The
         * window holds a *long* insertion" puts one on any view zoomed out far
         * enough that even a long bar falls under the 2px cell floor; that was
         * three of the fourteen committed figures carrying this display, each
         * gaining one entry and no glyph.
         *
         * It asks whether a marker is drawn at ANY sub-pixel pan position, not
         * at the one on screen. The painter's own answer flips on the snap phase
         * — a cell of a given span measures `floor(spanPx)` or one more — so an
         * exactly-painter-faithful entry blinks on and off mid-drag on the
         * long-REF-plus-longer-ALT shape, and a single-frame export would have
         * to settle to be right. The only divergence is an entry shown while
         * the glyph is under the cell floor at this particular phase, which is
         * strictly narrower than either approximation above.
         */
        get drawsInsertionMarkers(): boolean {
          if (!self.showInsertionGlyphs || !self.atGenomicPositions) {
            return false
          }
          // `effectiveRowHeight` read directly, never through `renderState`:
          // that object also carries `scrollTop`, so depending on it walked
          // every feature again per wheel-scroll frame. `canvasWidthPx` is not
          // read at all — it enters the painter's answer only through the snap
          // phase, which is exactly what this getter declines to depend on.
          const drawnRowHeight = drawnCellHeightPx(self.effectiveRowHeight)
          for (const block of self.renderBlocks) {
            const region = self.perRegionCellMap.get(block.displayedRegionIndex)
            if (
              region?.numCells &&
              anyMarkerPossibleForBlock(region, block, drawnRowHeight)
            ) {
              return true
            }
          }
          return false
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
          const { cellData } = self
          if (cellData?.mode === 'regular') {
            for (const k in cellData.perRegionCellData) {
              const info =
                cellData.perRegionCellData[k]!.featureGenotypeMap[featureId]
              if (info) {
                return info
              }
            }
          }
          return undefined
        },
      }))
      // separate block so the lane chain reads its siblings off `self`
      .views(self => ({
        /**
         * #getter
         * The lane's marks as plugin-canvas render data, one entry per fetched
         * region — the payload that display's own RPC produces, built here from
         * records this display already parsed. Empty when the band is off, so
         * every getter below it does no work.
         *
         * See `buildLaneRenderData` for why this is main-thread and costs no
         * second fetch. A MobX computed, rebuilt when the payload or the label
         * mode changes: keyed off the fetched `perRegionCellData`, not the
         * row-placed `perRegionCellMap`, since a record's mark does not move
         * with the rows, and off the **displayed regions'** bounds, never
         * `visibleRegions`, which the LGV rebuilds on every pan and zoom frame.
         * Either would re-run the whole chain below — SimpleFeature per
         * record, jexl color eval, packing, label solves — per reorder or per
         * frame.
         */
        get laneRenderDataMap(): ReadonlyMap<number, LayoutRegionData> {
          const out = new Map<number, LayoutRegionData>()
          // the payload is read only once the band is on, so an arrival
          // wakes nothing downstream while it is off
          const cellData =
            self.canRender && self.topBands.laneHeight > 0
              ? self.cellData
              : undefined
          if (cellData?.mode === 'regular') {
            const config = self.laneDisplayConfig
            const { jexl } = getEnv<{ pluginManager: PluginManager }>(
              self,
            ).pluginManager
            const { displayedRegions } = self.view
            for (const k in cellData.perRegionCellData) {
              const displayedRegionIndex = Number(k)
              const data = cellData.perRegionCellData[k]!
              const region = displayedRegions[displayedRegionIndex]
              if (region && data.featureIdList.length) {
                out.set(
                  displayedRegionIndex,
                  buildLaneRenderData({
                    data,
                    region: {
                      displayedRegionIndex,
                      assemblyName: region.assemblyName,
                      refName: region.refName,
                      start: region.start,
                      end: region.end,
                    },
                    config,
                    jexl,
                  }),
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
         * frame of a smooth zoom. Reversal off `displayedRegions` — stable
         * across pan frames — for the reason `laneRenderDataMap` gives.
         */
        get laneLayoutInputs(): Omit<
          LayoutInputs,
          'showLabels' | 'showDescriptions'
        > {
          const reversedRegions = new Set<number>()
          const { displayedRegions } = self.view
          for (let i = 0; i < displayedRegions.length; i++) {
            if (displayedRegions[i]!.reversed) {
              reversedRegions.add(i)
            }
          }
          return {
            bpPerPx: self.view.coarseBpPerPx,
            reversedRegions,
            displayMode: LANE_DISPLAY_MODE,
            pinnedFeatureIds: NO_PINNED_FEATURES,
            // The band is a fixed 40px holding a whole callset, so its records
            // are meant to share pixels rather than each claim a row: stacking
            // them honestly needs 68px, which costs the band every name through
            // the fit ladder. Names survive because this flattens the rows
            // without `displayMode: 'collapsed'`'s label suppression.
            flattenRows: true,
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
          const names = {
            showLabels: self.topBands.wantsName,
            showDescriptions: false,
            dropBelowLabelRows: false,
          }
          return resolveFitLadder(
            [
              {
                level: 'full',
                reserved: {
                  ...names,
                  showDescriptions: self.topBands.wantsDescription,
                },
                layout: () => full,
              },
              { level: 'labels', reserved: names, layout: labelsOnly },
              { level: 'decimated', reserved: names, layout: decimated },
              {
                level: 'bodies',
                reserved: { ...names, showLabels: false },
                layout: bodies,
              },
            ],
            self.topBands.laneHeight,
            // the same floor a track's squeeze bottoms out at, and the same one
            // every variant painter here already draws to (`variantCellSpanPx`)
            squeezeFloorScale(shortestBox, MIN_FIT_BOX_PX),
            // the display mode's compact ratio inverted: a sparse band fills up
            // to normal feature height and no further
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
         * Which label kinds the lane actually paints: what the kept rung
         * reserved, so a box never reserves width for a description the band
         * had no room to draw.
         */
        get laneRenderedLabels() {
          const { showLabels, showDescriptions } = self.laneFitStage
          return { showLabels, showDescriptions }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-region hit index over the lane's laid-out marks — plugin-canvas's,
         * built off the same stack it painted, so the box under the cursor is the
         * box the pick returns. Its label overhang is part of the hit box there,
         * which is why this reads the RENDERED label flags and not the mode's.
         *
         * Uses Canvas's `flatbushIndexes` dependencies: keyed off
         * `laneLaidOutDataMap` and the DEBOUNCED `coarseBpPerPx`, never
         * `visibleRegions` (per-frame fresh) or the live block width, so the
         * `LaneHitIndexes` autorun can hold it alive without per-frame rebuilds.
         * Without that subscription its only reader is the hit test, running
         * untracked in pointer handlers, so MobX would discard the value and
         * rebuild a Hilbert-sorted Flatbush with a text measurement per mark on
         * every pointer frame over the band.
         */
        get laneFlatbushIndexes() {
          const { showLabels, showDescriptions } = self.laneRenderedLabels
          const { reversedRegions } = self.laneLayoutInputs
          const bpPerPx = self.view.coarseBpPerPx
          const out = new Map<number, FlatbushRegionIndexes>()
          for (const [displayedRegionIndex, data] of self.laneLaidOutDataMap) {
            out.set(displayedRegionIndex, {
              feature: buildFeatureFlatbushIndex(
                data.flatbushItems,
                data.floatingLabelsData,
                bpPerPx,
                reversedRegions.has(displayedRegionIndex),
                { showLabels, showDescriptions, fontSize: self.laneFontSize },
              ),
              // A VCF record has no subfeatures, so `layoutBox` emits none and
              // there is no second index to search.
              subfeature: null,
            })
          }
          return out
        },
      }))
      // separate block so renderSvg's `self` sees perRegionCellMap/renderBlocks
      // and insertionGlyphRegions
      .views(self => ({
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          if (self.atGenomicPositions) {
            const { renderSvg } = await import('./renderSvg.tsx')
            return renderSvg(self, opts)
          }
          const { renderSvg } = await import('./matrix/renderMatrixSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The layout's chrome hands over its backend; a layout switch mounts
         * the other chrome, whose backend replaces this one. The upload
         * lifecycle is installed once, so its cells and its render follow the
         * backend attached rather than the setting: until the other chrome's
         * backend arrives, the old one is sent nothing it cannot draw.
         */
        startRenderingBackend(backend: VariantLayoutBackend) {
          self.setBackendDrawsColumns(backend.columns)
          installUpload<
            number,
            Placed<ShippedRegionData> | VariantMatrixUploadData,
            VariantLayoutBackend
          >(self, backend, {
            cells: () =>
              self.backendDrawsColumns
                ? self.matrixRegions
                : self.perRegionCellMap,
            // the width follows the backend, not the setting, which the
            // outgoing backend still sees for one flush after a switch
            render: b =>
              b.columns
                ? b.renderBlocks(self.matrixBlocks, self.matrixRegions, {
                    ...self.renderState,
                    canvasWidth: self.matrixWidth,
                  })
                : b.renderBlocks(self.renderBlocks, self.perRegionCellMap, {
                    ...self.renderState,
                    canvasWidth: self.canvasWidthPx,
                  }),
          })
        },
      }))
      .actions(self => ({
        // The MST fork auto-chains lifecycle hooks, so the base's afterAttach
        // still runs — no super call.
        afterAttach() {
          // The hit test reads this only from untracked pointer handlers, so
          // without an observer MobX discards the computed per read — the
          // CanvasHitIndexes rule (packages/display-kit/CLAUDE.md), earned
          // here by the getter's debounced, non-per-frame dependency set.
          autorunOnReadyView(
            self,
            () => {
              void self.laneFlatbushIndexes
            },
            { name: 'LaneHitIndexes' },
          )
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
