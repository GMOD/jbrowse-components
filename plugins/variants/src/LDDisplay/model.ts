import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { reservedPx } from '@jbrowse/core/util/bandLayout'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import TriangleMatrixMixin from '@jbrowse/display-kit/TriangleMatrixMixin'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { triangleAxis } from '@jbrowse/display-kit/triangleTransform'
import { ldValueComputed } from '@jbrowse/ld-core'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'

import { bandPairIndex } from '../VariantRPC/ldBand.ts'
import { clampLineZoneHeight } from '../shared/constants.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { generateLDColorRamp, ldMetricLabel } from './components/ldColorRamp.ts'
import { buildLDTrackMenuItems } from './trackMenuItems.ts'

import type { RenderLDDataArgs } from '../RenderLDDataRPC/RenderLDData.ts'
import type { LDCellHit, LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { LDMetric, LDSnp } from '../VariantRPC/ldTypes.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { LDRenderingBackend } from './components/ldRenderingBackendTypes.ts'
import type { LDDisplayConfigSchema } from './configSchemaLDTrack.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/** The RPC's settings, derived from its args so a field cannot be misnamed. */
export type LDRpcProps = Omit<
  RenderLDDataArgs,
  'adapterConfig' | 'regions' | 'originBp' | 'spanBp'
>

function upperBoundFloat32(arr: Float32Array, val: number) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! <= val) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * #stateModel LDTrackDisplay
 * #displayFoundation GlobalFetchMixin
 * #category display
 * A linkage disequilibrium matrix read from a pre-computed file, drawn as a
 * triangle over the view.
 */
export default function stateModelFactory(configSchema: LDDisplayConfigSchema) {
  return types
    .compose(
      'LDTrackDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalFetchMixin(),
      LegendMixin(),
      TriangleMatrixMixin<LDDataResult>(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LDTrackDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Locus (`refName:start`) of the SNP whose row and column are
       * emphasized. A locus rather than an index, so it survives a refetch.
       */
      focalSnpLocus: undefined as string | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFocalSnp(snp: LDSnp | undefined) {
        self.focalSnpLocus = snp ? `${snp.refName}:${snp.start}` : undefined
      },
      /**
       * #action
       */
      setLineZoneHeight(n: number) {
        setConf(
          self,
          'lineZoneHeight',
          clampLineZoneHeight(getConf(self, 'lineZoneHeight'), n),
        )
      },
      /**
       * #action
       */
      setLDMetric(metric: LDMetric) {
        setConf(self, 'ldMetric', metric)
      },
      /**
       * #action
       */
      setShowLDTriangle(show: boolean) {
        setConf(self, 'showLDTriangle', show)
      },
      /**
       * #action
       */
      setShowVerticalGuides(show: boolean) {
        setConf(self, 'showVerticalGuides', show)
      },
      /**
       * #action
       */
      setShowLabels(show: boolean) {
        setConf(self, 'showLabels', show)
      },
      /**
       * #action
       */
      setVariantLayout(value: 'genomic' | 'columns') {
        setConf(self, 'variantLayout', value)
      },
    }))
    .views(self => ({
      get view() {
        return containingLgv(self)
      },
      /**
       * #getter
       */
      get prefersOffset() {
        return true
      },
      /**
       * #getter
       */
      get lineZoneHeight(): number {
        return getConf(self, 'lineZoneHeight')
      },
      /**
       * #getter
       */
      get ldMetric(): LDMetric {
        return getConf(self, 'ldMetric')
      },
      /**
       * #getter
       */
      get showLDTriangle(): boolean {
        return getConf(self, 'showLDTriangle')
      },
      /**
       * #getter
       */
      get maxVariantSeparation(): number {
        return getConf(self, 'maxVariantSeparation')
      },
      /**
       * #getter
       */
      get showVerticalGuides(): boolean {
        return getConf(self, 'showVerticalGuides')
      },
      /**
       * #getter
       */
      get showLabels(): boolean {
        return getConf(self, 'showLabels')
      },
      /**
       * #getter
       */
      get tickHeight(): number {
        return getConf(self, 'tickHeight')
      },
      /**
       * #getter
       */
      get variantLayout(): 'genomic' | 'columns' {
        return getConf(self, 'variantLayout')
      },
      /**
       * #getter
       * The loaded SNPs in screen order along the column axis.
       */
      get snps(): LDSnp[] {
        return self.rpcData?.snps ?? []
      },
      /**
       * #getter
       * The column width the payload was laid out at.
       */
      get cellWidth(): number {
        return self.rpcData?.uniformW ?? 0
      },
      /**
       * #getter
       * The dynamic blocks: the SNP set is the viewport's, so a pan refetches
       * while the stale triangle draws under the live transform.
       */
      get viewSignature(): string | undefined {
        return self.dynamicBlockSignature
      },
      /**
       * #getter
       * With the triangle off nothing loads or ever will, which the scrim, the
       * SVG export's `svgReady` and `painted` all need to know.
       */
      get fetchInert(): boolean {
        return !getConf(self, 'showLDTriangle')
      },
      /**
       * #getter
       * The metric the loaded values are: a file with one column serves it
       * whichever is asked for.
       */
      get effectiveLdMetric(): LDMetric {
        return self.rpcData?.metric ?? getConf(self, 'ldMetric')
      },
      /**
       * #getter
       * Whether the loaded matrix is at genomic positions: a multi-region view
       * falls back to uniform columns.
       */
      get effectiveUseGenomicPositions(): boolean {
        return (
          self.rpcData?.genomicMode ??
          getConf(self, 'variantLayout') === 'genomic'
        )
      },
      /**
       * #getter
       */
      get r2Available(): boolean {
        return self.rpcData?.hasR2 ?? true
      },
      /**
       * #getter
       */
      get dprimeAvailable(): boolean {
        return self.rpcData?.hasDprime ?? true
      },
      /**
       * #getter
       * The pair window the loaded matrix was computed at, or undefined for
       * the whole triangle. The status bar names it: a pair past it is not
       * drawn, which reads the same as no linkage on a light background.
       */
      get loadedLDWindow(): number | undefined {
        const data = self.rpcData
        return data && data.band > 0 && data.band < data.snps.length - 1
          ? data.band
          : undefined
      },
      /**
       * #getter
       * Index of the focal SNP in `snps`, or -1.
       */
      get focalSnpIndex(): number {
        const locus = self.focalSnpLocus
        return locus === undefined
          ? -1
          : this.snps.findIndex(s => `${s.refName}:${s.start}` === locus)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The metric's ramp, out of the LUT the cells are painted through.
       */
      get colorScales(): ColorScale[] {
        const metric = self.effectiveLdMetric
        return [
          {
            kind: 'ramp',
            id: 'ld',
            title: ldMetricLabel(metric),
            domain: [0, 1],
            stops: stopsFromRampLut(generateLDColorRamp(metric), 11),
          },
        ]
      },
      /**
       * #getter
       * The band above the matrix: the connector lines in columns, the labels
       * at genomic positions when they are on, else nothing.
       */
      get matrixTop(): number {
        return reservedPx({
          active: !self.effectiveUseGenomicPositions || self.showLabels,
          height: self.lineZoneHeight,
        })
      },
      /**
       * #method
       */
      rpcProps(): LDRpcProps {
        return {
          ldMetric: self.ldMetric,
          maxVariantSeparation: self.maxVariantSeparation,
          useGenomicPositions: self.variantLayout === 'genomic',
        }
      },
      /**
       * #method
       * Viewport x of a fractional column index: `i + 0.5` is column i's apex.
       * Through the payload's own column width, so it follows the live
       * transform through a zoom's refetch.
       */
      columnX(column: number) {
        const { viewScale, viewOffsetX } = self.viewTransform
        return column * self.cellWidth * Math.SQRT2 * viewScale + viewOffsetX
      },
      /**
       * #method
       * Viewport x of a locus, or undefined when it has none.
       */
      locusViewportX(refName: string, coord: number): number | undefined {
        return locusViewportXFor(self)(refName, coord)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Each column tied to its SNP's genomic x, for the connector lines.
       */
      get connectorLineCoords(): ConnectorCoord[] {
        const locusX = locusViewportXFor(self)
        return self.snps
          .map((snp, i) => {
            const gx = locusX(snp.refName, snp.start)
            return gx === undefined
              ? undefined
              : { mx: self.columnX(i + 0.5), gx, label: snp.id }
          })
          .filter(coord => coord !== undefined)
      },
      /**
       * #method
       * The computed cell under a display-px point: a pair outside the band,
       * or one no estimator filled, is not drawn and not hit.
       */
      hitTest(mouseX: number, mouseY: number): LDCellHit | undefined {
        const data = self.rpcData
        if (!data || mouseY < self.matrixTop) {
          return undefined
        }
        const { x, y } = self.screenToCell(mouseX, mouseY)
        const { boundaries, ldValues, band } = data
        const n = boundaries.length - 1
        const j = upperBoundFloat32(boundaries, x) - 1
        const i = upperBoundFloat32(boundaries, y) - 1
        const idx =
          i > j && i > 0 && j >= 0 && i < n ? bandPairIndex(i, j, band) : -1
        return idx < 0 || !ldValueComputed(ldValues[idx]!)
          ? undefined
          : {
              i,
              j,
              ldValue: ldValues[idx]!,
              snp1: self.snps[i]!,
              snp2: self.snps[j]!,
            }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      startRenderingBackend(backend: LDRenderingBackend) {
        installUpload(self, backend, {
          cells: () => self.matrixRegions,
          render: b =>
            b.renderBlocks(
              self.matrixBlocks,
              self.matrixRegions,
              self.triangleFrame,
            ),
        })
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [...superTrackMenuItems(), ...buildLDTrackMenuItems(self)]
        },
        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LDDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        installGlobalFetchAutorun(self, {
          prepare: () => {
            const regions = self.host.dynamicBlocks.contentBlocks
            if (!self.showLDTriangle || !regions.length) {
              return undefined
            }
            const { originBp, spanBp } = triangleAxis(
              regions,
              self.host.displayedRegions,
            )
            return { regions: [...regions], originBp, spanBp }
          },
          run: ({ regions, originBp, spanBp }, ctx) =>
            ctx.callRpc('RenderLDData', {
              ...rpcArgs(self),
              regions,
              originBp,
              spanBp,
            }),
          commit: result => {
            self.setRpcData(result)
          },
          delay: 500,
          name: 'LDDisplayRender',
        })
      },
    }))
}

export type LDDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDDisplayModel = Instance<LDDisplayStateModel>
