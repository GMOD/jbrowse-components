import { setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload, oneCell } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'
import { clampLineZoneHeight } from '../shared/constants.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { placeVariantRows } from '../shared/placeVariantRows.ts'
import { VARIANT_MATRIX_MARKS } from './components/variantMatrixMarks.ts'

import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { SharedVariantConfigModel } from '../shared/SharedVariantConfigSchema.ts'
import type { Placed } from '../shared/placeVariantRows.ts'
import type { MatrixHoveredCell } from './components/VariantMatrixComponent.tsx'
import type {
  VariantMatrixRenderBlock,
  VariantMatrixRenderingBackend,
  VariantMatrixUploadData,
} from './components/variantMatrixRenderingBackendTypes.ts'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

/** The upload payload plus what the (feature, row) → cell lookup reads. */
type PlacedMatrixData = Placed<
  VariantMatrixUploadData & { refCellCount: number }
>

/**
 * #stateModel LinearMultiSampleVariantMatrixDisplay
 * Multi-sample variant display rendering genotypes as a compact sample-by-site
 * matrix, with subpixel column alpha-scaling for anti-aliased parity.
 */
export default function stateModelFactory(
  configSchema: SharedVariantConfigModel,
) {
  return (
    types
      .compose(
        'LinearMultiSampleVariantMatrixDisplay',
        MultiSampleVariantBaseModelF(configSchema, 'matrix'),
        types.model({
          type: types.literal('LinearMultiSampleVariantMatrixDisplay'),
        }),
      )
      // Remap the old type literal on active (view-level) display instances. The
      // DisplayType `aliases` only covers the track *config*; the view's display
      // union dispatches on the raw `type`, so it needs this rewrite too.
      // Nothing to do for the `lineZoneHeight` an older session may carry here:
      // MST ignores a snapshot key with no matching property, and it's a config
      // slot now (like `height`), so the zone resolves to the configured height.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        snap?.type === 'LinearVariantMatrixDisplay'
          ? { ...snap, type: 'LinearMultiSampleVariantMatrixDisplay' }
          : snap,
      )
      .volatile(() => ({
        /**
         * #volatile
         * The genotype cell under the pointer, as `hoverInk` lights it. Beside
         * the base's `hoveredFeature` (the tooltip) for the reason the sibling
         * display keeps its own: the box needs the cell's instance, which the
         * shared tooltip slot has no reason to carry.
         */
        hoveredCell: undefined as MatrixHoveredCell | undefined,
      }))
      .actions(self => {
        const { clearHoveredFeature: superClearHoveredFeature } = self
        return {
          /**
           * #action
           */
          setHoveredCell(cell?: MatrixHoveredCell) {
            self.hoveredCell = cell
          },
          /**
           * #action
           * The base clears the tooltip; the highlight box goes with it.
           */
          clearHoveredFeature() {
            superClearHoveredFeature()
            self.hoveredCell = undefined
          },
        }
      })
      .views(() => ({
        /**
         * #getter
         * The matrix packs every column with a variant and paints its reference
         * cells in `REFERENCE_COLOR`, which is the grey `skip` would fill the
         * background with — so the toggle moves no pixel here and the row is
         * left off the menu.
         */
        get showsReferenceToggle() {
          return false
        },
        /**
         * #getter
         * A wash and a border: the cell colours are the data.
         */
        get highlightStyle(): HighlightStyle {
          return 'box'
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The matrix payload with its rows placed at the screen rows the display
         * is drawing, or undefined before data lands. The single walk every
         * matrix consumer reads — GPU upload, Canvas2D render and SVG export —
         * so none of them can paint the worker's arbitrary row numbering.
         *
         * Freshly allocated on every reorder, which is exactly what makes a
         * reorder a re-upload rather than a refetch: the buffer identity changes,
         * the upload autorun re-runs, and no RPC is involved. The regular display
         * does the same per region in `perRegionCellMap`.
         */
        // Annotated down to what the backends and the cell lookup consume,
        // rather than inferred: the inferred type drags the worker's whole
        // payload shape into this display's public type, and the SVG body would
        // then have to name it too.
        get placedMatrixData(): PlacedMatrixData | undefined {
          const { cellData, rowRemap } = self
          return cellData?.mode === 'matrix' && rowRemap
            ? placeVariantRows(cellData, rowRemap)
            : undefined
        },
        /**
         * #getter
         * The width the matrix is laid out in: the rounded **content** width,
         * so the columns still fill the drawn matrix when the genome doesn't
         * reach across the viewport. Not `canvasWidthPx`, which is the viewport
         * box every span-drawing display maps bp into — the matrix addresses
         * columns by index, so the content width is a different question, not a
         * different answer to the same one. Same name and same getter the LD
         * display's triangle takes for the same reason.
         *
         * In its own block ahead of every reader so they reach it through
         * `self`: the canvas element's CSS width, `renderState` (what the
         * backends size their backing store to) and `columnGeometry` (the
         * column pitch) have to be one number, or the cells are drawn against a
         * box they don't fill and the connector lines miss their columns.
         */
        get canvasWidth() {
          return self.view.totalWidthPxWithoutBorders
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-frame render state for the GPU backend — the autorun reads this
         * every time any tracked observable (cellData, scrollTop, rowHeight,
         * canvas width, …) changes.
         */
        // Resolved geometry, never undefined: whether a matrix-mode payload
        // exists is the render callback's gate (it already passes `null` data),
        // not a nullable state.
        get renderState() {
          return {
            // Same rounded width the canvas, hit-test, and connector lines use,
            // so cells/lines/clicks stay pixel-aligned.
            canvasWidth: self.canvasWidth,
            canvasHeight: self.availableHeight,
            rowHeight: self.effectiveRowHeight,
            scrollTop: self.scrollTop,
          }
        },
        /**
         * #getter
         * The matrix as the mark backend's region map: one payload under key
         * 0, left out while it has no cells so the backend answers "nothing
         * drawn" and the loading scrim stays over a blank canvas.
         */
        get matrixRegions(): ReadonlyMap<number, VariantMatrixUploadData> {
          const data = self.placedMatrixData
          return oneCell(0, data?.numCells ? data : undefined)
        },
        /**
         * #getter
         * The one block the mark backend draws: the whole canvas, spanning
         * the column indices. A column is addressed by index rather than bp,
         * so the block carries the clip and the payload's `numFeatures`
         * carries the pitch.
         */
        get matrixBlocks(): VariantMatrixRenderBlock[] {
          const { canvasWidth } = self
          return [
            {
              displayedRegionIndex: 0,
              start: 0,
              end: self.placedMatrixData?.numFeatures ?? 0,
              screenStartPx: 0,
              screenEndPx: canvasWidth,
              reversed: false,
            },
          ]
        },
        /**
         * #getter
         * Column pitch and origin of the matrix in viewport pixels: `left` is
         * where the content starts when it doesn't reach the left viewport edge
         * (offsetPx < 0), `columnWidth` the per-column width the canvas lays out
         * at. The connector lines, their hit-test, and the crosshair column all
         * key off this so columns/lines/clicks stay pixel-aligned.
         */
        get columnGeometry() {
          const view = self.host
          const n = self.featuresVolatile?.length
          return {
            n: n ?? 0,
            columnWidth: n ? self.canvasWidth / n : 0,
            left: Math.max(0, -view.offsetPx),
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * One connector per matrix column, **by column**, in viewport pixels:
         * `mx` the column centre, `gx` the feature's genomic position on the
         * ruler, `label` what the hover tooltip shows. `undefined` where a
         * feature's refName has left the view and there is no genomic x to point
         * at — dropped rather than pinned to the left edge.
         *
         * Indexed rather than filtered, because the crosshair asks of one
         * column what the drawn field asks of all of them and a filtered list
         * cannot answer it: dropping an entry shifts every index past it. So
         * this is the one walk — the field filters it, the crosshair indexes it,
         * and the highlighted line is one OF the drawn lines rather than a
         * second answer to where that line goes.
         *
         * Screen column and data index are the same number: the worker hands the
         * features back in screen order (`orderByScreenPosition`), so nothing
         * here has to invert a mirror.
         */
        get connectorCoordsByColumn(): (ConnectorCoord | undefined)[] {
          const locusX = locusViewportXFor(self)
          const features = self.featuresVolatile
          const { columnWidth, left } = self.columnGeometry
          return features
            ? features.map((feature, i) => {
                const gx = locusX(feature.get('refName'), feature.get('start'))
                return gx === undefined
                  ? undefined
                  : {
                      mx: left + (i + 0.5) * columnWidth,
                      gx,
                      label: feature.get('name'),
                    }
              })
            : []
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The box of the hovered genotype cell, for the chrome's highlight: the
         * cell's instance through the matrix cell mark's ink, moved to where
         * the canvas sits in the display — past the bands above the rows and
         * the column origin.
         */
        get hoverInk(): HighlightRect[] {
          const cell = self.hoveredCell
          if (!cell) {
            return []
          }
          const { left } = self.columnGeometry
          const top = self.rowsTopOffset
          return inkOfInstances(
            VARIANT_MATRIX_MARKS,
            self.matrixBlocks,
            index => self.matrixRegions.get(index),
            self.renderState,
            () => [{ mark: 0, index: cell.cellIndex }],
          ).map(r => ({ ...r, left: r.left + left, top: r.top + top }))
        },
        /**
         * #getter
         * The connector lines that actually draw — `connectorCoordsByColumn`
         * without the columns that have no genomic x.
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
      .actions(self => ({
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
        startRenderingBackend(backend: VariantMatrixRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.matrixRegions,
            render: b =>
              b.renderBlocks(
                self.matrixBlocks,
                self.matrixRegions,
                self.renderState,
              ),
          })
        },
      }))
      // separate block so renderSvg's `self` sees renderState and the connector
      // zone's setLineZoneHeight
      .views(self => ({
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
  )
}

export type LinearMultiSampleVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiSampleVariantMatrixDisplayModel =
  Instance<LinearMultiSampleVariantMatrixDisplayStateModel>
