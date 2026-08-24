import { setConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { installGlobalLifecycle } from '@jbrowse/render-core/installGlobalLifecycle'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'
import { clampLineZoneHeight } from '../shared/constants.ts'
import { genomicViewportX } from '../shared/genomicViewportX.ts'
import { placeVariantRows } from '../shared/placeVariantRows.ts'

import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { SharedVariantConfigModel } from '../shared/SharedVariantConfigSchema.ts'
import type {
  VariantMatrixRenderingBackend,
  VariantMatrixUploadData,
} from './components/variantMatrixRenderingBackendTypes.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
      .views(self => ({
        get prefersOffset() {
          return true
        },
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
        // Annotated down to what the backends actually consume, rather than
        // inferred: the inferred type drags the worker's whole payload shape
        // into this display's public type, and the SVG body would then have to
        // name it too.
        get placedMatrixData(): VariantMatrixUploadData | undefined {
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
         * Column pitch and origin of the matrix in viewport pixels: `left` is
         * where the content starts when it doesn't reach the left viewport edge
         * (offsetPx < 0), `columnWidth` the per-column width the canvas lays out
         * at. The connector lines, their hit-test, and the crosshair column all
         * key off this so columns/lines/clicks stay pixel-aligned.
         */
        get columnGeometry() {
          const view = self.lgv
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
          const view = self.view
          const { assemblyManager } = getSession(self)
          const assembly = assemblyManager.get(view.assemblyNames[0]!)
          const features = self.featuresVolatile
          const { columnWidth, left } = self.columnGeometry
          return assembly && features
            ? features.map((feature, i) => {
                const gx = genomicViewportX(
                  view,
                  assembly,
                  feature.get('refName'),
                  feature.get('start'),
                )
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
          installGlobalLifecycle<VariantMatrixRenderingBackend>(self, backend, {
            upload: b => {
              const { placedMatrixData } = self
              if (placedMatrixData) {
                b.uploadData(placedMatrixData)
              }
            },
            // The backend answers "did real content reach the canvas", the same
            // way a per-region `renderBlocks` does (ADR-009). It used to be this
            // callback's answer, and "the placed data is here" was the wrong
            // question: a payload with no cells paints nothing, and flipping
            // `canvasDrawn` over it would let the loading scrim drop and the
            // first snapshot catch a blank canvas.
            render: b =>
              b.render(self.placedMatrixData ?? null, self.renderState),
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
