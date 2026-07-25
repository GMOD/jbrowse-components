import { setConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'
import { clampLineZoneHeight } from '../shared/constants.ts'
import { genomicViewportX } from '../shared/genomicViewportX.ts'
import { mirrorColumnIndex } from './components/variantMatrixRenderingBackendTypes.ts'

import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { SharedVariantConfigModel } from '../shared/SharedVariantConfigSchema.ts'
import type { VariantMatrixRenderingBackend } from './components/variantMatrixRenderingBackendTypes.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

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
      // union dispatches on the raw `type`, so it needs this rewrite too. A
      // `lineZoneHeight` left over from when it was an instance property is
      // dropped: it's a config slot now (like `height`), and a display snapshot
      // can't write the track config, so the zone returns to the configured
      // height rather than half-restoring.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
        const { lineZoneHeight, ...rest } = snap ?? {}
        return snap === undefined
          ? snap
          : rest.type === 'LinearVariantMatrixDisplay'
            ? { ...rest, type: 'LinearMultiSampleVariantMatrixDisplay' }
            : rest
      })
      .views(self => ({
        /**
         * #getter
         * True when every visible region is reversed (the view is horizontally
         * flipped). The matrix lays columns out by genomic-ascending feature
         * index, but a flipped view runs the ruler right-to-left, so columns are
         * mirrored to `numFeatures-1-i` to keep them and the genome connector
         * lines from crossing. Mixed forward/reversed regions don't flip.
         */
        get flipped(): boolean {
          const view = getContainingView(self) as LinearGenomeViewModel
          const regions = view.visibleRegions
          return regions.length > 0 && regions.every(r => r.reversed)
        },
      }))
      .views(self => ({
        get blockType() {
          return 'dynamicBlocks'
        },
        get prefersOffset() {
          return true
        },
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
          const view = getContainingView(self) as LinearGenomeViewModel
          return {
            // Same rounded width the canvas, hit-test, and connector lines use,
            // so cells/lines/clicks stay pixel-aligned.
            canvasWidth: view.totalWidthPxWithoutBorders,
            canvasHeight: self.availableHeight,
            rowHeight: self.effectiveRowHeight,
            scrollTop: self.scrollTop,
            flipped: self.flipped,
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
          const view = getContainingView(self) as LinearGenomeViewModel
          const n = self.featuresVolatile?.length
          return {
            n: n ?? 0,
            columnWidth: n ? view.totalWidthPxWithoutBorders / n : 0,
            left: Math.max(0, -view.offsetPx),
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The connector lines tying each matrix column to its feature's genomic
         * position, in viewport pixels, plus the label the hover tooltip shows.
         * A feature whose refName has left the view has no genomic x and is
         * dropped rather than pinned to the left edge.
         */
        get connectorLineCoords(): ConnectorCoord[] {
          const view = getContainingView(self) as LinearGenomeViewModel
          const { assemblyManager } = getSession(self)
          const assembly = assemblyManager.get(view.assemblyNames[0]!)
          const features = self.featuresVolatile
          const { n, columnWidth, left } = self.columnGeometry
          return assembly && features
            ? features
                .map((feature, i) => {
                  const gx = genomicViewportX(
                    view,
                    assembly,
                    feature.get('refName'),
                    feature.get('start'),
                  )
                  return gx === undefined
                    ? undefined
                    : {
                        mx:
                          left +
                          (mirrorColumnIndex(i, n, self.flipped) + 0.5) *
                            columnWidth,
                        gx,
                        label: feature.get('name'),
                      }
                })
                .filter(coord => coord !== undefined)
            : []
        },
        /**
         * #method
         * The connector for the column under `screenX` (the crosshair), or
         * undefined off the ends. crosshairX picks a *screen* column, so mirror
         * it back to the data index — on a flipped view the feature drawn there
         * is not the one at that index.
         */
        connectorLineAtScreenX(screenX: number): ConnectorCoord | undefined {
          const view = getContainingView(self) as LinearGenomeViewModel
          const { assemblyManager } = getSession(self)
          const assembly = assemblyManager.get(view.assemblyNames[0]!)
          const features = self.featuresVolatile
          const { n, columnWidth, left } = self.columnGeometry
          const screenCol = Math.floor((screenX - left) / columnWidth)
          const feature =
            assembly && features && screenCol >= 0 && screenCol < n
              ? features[mirrorColumnIndex(screenCol, n, self.flipped)]!
              : undefined
          const gx =
            assembly && feature
              ? genomicViewportX(
                  view,
                  assembly,
                  feature.get('refName'),
                  feature.get('start'),
                )
              : undefined
          return gx === undefined
            ? undefined
            : { mx: left + (screenCol + 0.5) * columnWidth, gx }
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        setLineZoneHeight(n: number) {
          setConf(self, 'lineZoneHeight', clampLineZoneHeight(n))
        },
        /**
         * #action
         */
        startRenderingBackend(backend: VariantMatrixRenderingBackend) {
          self.attachRenderingBackend<VariantMatrixRenderingBackend>(backend, {
            upload: b => {
              const { cellData } = self
              if (cellData?.mode === 'matrix') {
                b.uploadData(cellData)
              }
            },
            // A monolithic backend's `render` returns void, so the "did real
            // content reach the canvas" answer has to come from here — unlike a
            // per-region `renderBlocks`, which answers it itself (ADR-009). Skip
            // the tick rather than paint an empty frame: painting one flips
            // `canvasDrawn`, and the loading scrim and every `-done` selector key
            // off that, so the first snapshot would catch a blank canvas.
            render: b => {
              const { cellData } = self
              if (cellData?.mode === 'matrix') {
                b.render(cellData, self.renderState)
                return true
              } else {
                return false
              }
            },
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
