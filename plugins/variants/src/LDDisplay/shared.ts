import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { GRADIENT_LEGEND_SVG_AREA_WIDTH } from '@jbrowse/core/ui'
import { checkboxItem } from '@jbrowse/core/ui/menuItems'
import { getRpcSessionId, getSession, maxFinite } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
  computeTriangleYScalar,
  squashToHeightCheckboxItem,
} from '@jbrowse/plugin-linear-genome-view'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { isPrecomputedLDAdapter } from '../RenderLDDataRPC/types.ts'
import { clampLineZoneHeight } from '../shared/constants.ts'
import { genomicViewportX } from '../shared/genomicViewportX.ts'
// lazy: this is a state model, so a dialog named here is in every host's first
// paint — see ../shared/lazyDialogs.ts
import { AddFiltersDialog, LDFilterDialog } from '../shared/lazyDialogs.ts'
import { generateLDColorRamp } from './components/ldColorRamp.ts'
import { toLDUploadData } from './components/ldRenderingBackendTypes.ts'

import type { LDDataResult, LDFlatbushItem } from '../RenderLDDataRPC/types.ts'
import type {
  FilterStats,
  LDMethod,
  LDMetric,
  LDSnp,
} from '../VariantRPC/getLDMatrix.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { LDDisplayConfigSchema } from './SharedLDConfigSchema.ts'
import type {
  LDRenderState,
  LDRenderingBackend,
} from './components/ldRenderingBackendTypes.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

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
 * #stateModel SharedLDModel
 * #displayFoundation GlobalDataDisplayMixin
 * #category display
 * Shared state model for LD displays
 */
export default function sharedModelFactory(
  configSchema: LDDisplayConfigSchema,
) {
  return types
    .compose(
      'SharedLDModel',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalDataDisplayMixin(),
      StaleViewportRescaleMixin(),
      types.model({
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as LDDataResult | null,
      /**
       * #volatile
       * Locus (`refName:start`) of the focal SNP whose LD row+column is
       * emphasized, or undefined. Keyed by locus rather than array index so
       * the selection survives a re-fetch that reorders SNPs.
       */
      focalSnpLocus: undefined as string | undefined,
    }))
    .actions(self => ({
      setRpcData(data: LDDataResult | null) {
        self.rpcData = data
      },
      setFocalSnp(snp: LDSnp | undefined) {
        self.focalSnpLocus = snp ? `${snp.refName}:${snp.start}` : undefined
      },
      setLineZoneHeight(n: number) {
        setConf(self, 'lineZoneHeight', clampLineZoneHeight(n))
      },
      setMafFilter(arg: number) {
        setConf(self, 'minorAlleleFrequencyFilter', arg)
      },
      setLDMetric(metric: LDMetric) {
        setConf(self, 'ldMetric', metric)
      },
      setShowLegend(show: boolean) {
        setConf(self, 'showLegend', show)
      },
      setShowLDTriangle(show: boolean) {
        setConf(self, 'showLDTriangle', show)
      },
      setShowRecombination(show: boolean) {
        setConf(self, 'showRecombination', show)
      },
      setSquashToHeight(value: boolean) {
        setConf(self, 'squashToHeight', value)
      },
      setHweFilter(threshold: number) {
        setConf(self, 'hweFilterThreshold', threshold)
      },
      setCallRateFilter(threshold: number) {
        setConf(self, 'callRateFilter', threshold)
      },
      setShowVerticalGuides(show: boolean) {
        setConf(self, 'showVerticalGuides', show)
      },
      setShowLabels(show: boolean) {
        setConf(self, 'showLabels', show)
      },
      setUseGenomicPositions(value: boolean) {
        setConf(self, 'useGenomicPositions', value)
      },
      setSignedLD(value: boolean) {
        setConf(self, 'signedLD', value)
      },
      setJexlFilters(filters: string[] | undefined) {
        setConf(self, 'jexlFilters', filters)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get prefersOffset() {
        return true
      },
      get minorAlleleFrequencyFilter() {
        return getConf(self, 'minorAlleleFrequencyFilter')
      },
      get lengthCutoffFilter() {
        return getConf(self, 'lengthCutoffFilter')
      },
      get lineZoneHeight() {
        return getConf(self, 'lineZoneHeight')
      },
      get ldMetric() {
        return getConf(self, 'ldMetric')
      },
      get showLegend() {
        return getConf(self, 'showLegend')
      },
      get showLDTriangle() {
        return getConf(self, 'showLDTriangle')
      },
      get showRecombination() {
        return getConf(self, 'showRecombination')
      },
      get recombinationZoneHeight() {
        return getConf(self, 'recombinationZoneHeight')
      },
      get squashToHeight() {
        return getConf(self, 'squashToHeight')
      },
      get hweFilterThreshold() {
        return getConf(self, 'hweFilterThreshold')
      },
      get callRateFilter() {
        return getConf(self, 'callRateFilter')
      },
      get showVerticalGuides() {
        return getConf(self, 'showVerticalGuides')
      },
      get showLabels() {
        return getConf(self, 'showLabels')
      },
      get tickHeight() {
        return getConf(self, 'tickHeight')
      },
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST getter named after config slot
      get useGenomicPositions() {
        return getConf(self, 'useGenomicPositions')
      },
      get signedLD() {
        return getConf(self, 'signedLD')
      },
      get jexlFilters(): string[] {
        return getConf(self, 'jexlFilters')
      },
      /**
       * #getter
       * Returns true if this display uses pre-computed LD data (PLINK, ldmat)
       * rather than computing LD from VCF genotypes
       */
      get snps(): LDSnp[] {
        return self.rpcData?.snps ?? []
      },
      get cellWidth() {
        return self.rpcData?.uniformW ?? 0
      },
      get filterStats(): FilterStats | undefined {
        return self.rpcData?.filterStats
      },
      get recombination() {
        return self.rpcData?.recombination
      },
      /**
       * #getter
       * The shared freshness hook, read by `GlobalFetchMixin.svgReady`. The
       * fetch commits `rpcData` even
       * for an empty viewport, so this flips true once data has loaded AND that
       * data was fetched for the current viewport. Gating on freshness — not
       * merely `rpcData !== null` — keeps off-screen `svgReady` from resolving on
       * data left over from the pre-pan/zoom viewport during the debounced-refetch
       * window (`setLastDrawnViewport` runs right after `setRpcData`). Without the
       * override the mixin default (`false`) leaves `svgReady` unable to resolve
       * on a successful load, hanging SVG export.
       */
      get dataCurrent(): boolean {
        return self.rpcData !== null && self.viewportFresh
      },
      /**
       * #getter
       * Override of the `GlobalDataDisplayMixin` hook that gates the initial
       * pre-first-paint loading scrim (`rendersCanvas && !canvasDrawn`). With
       * the triangle toggled off, `LDDisplayComponent` renders an EmptyState
       * ("Enable LD triangle…") instead of a canvas, so `canvasDrawn` never
       * flips. Returning false here keeps the scrim from sitting permanently
       * over that placeholder. This is the *only* override of the hook — do not
       * remove it as dead-looking single-use code: without it the LD track
       * shows a stuck loading spinner whenever the triangle is disabled. If the
       * EmptyState is ever moved outside `DisplayChrome`, revisit together.
       */
      // reads the slot rather than the sibling `showLDTriangle` getter: that one
      // lives in this same `.views()` block, where `self` isn't yet typed with
      // it (see BaseLinearDisplay/CLAUDE.md on block-local `self` typing)
      get rendersCanvas(): boolean {
        return getConf(self, 'showLDTriangle')
      },
      /**
       * #getter
       * The same toggle, answering the *export* question rather than the scrim
       * one. With the triangle off `shouldFetch` is false forever, so `rpcData`
       * stays null and `dataCurrent` can never flip — and `awaitSvgReady` is an
       * unbounded `when`, so one such track hangs the whole view's SVG export.
       * Marking it terminal lets the export proceed; `LdSvgBody` already returns
       * null on absent `rpcData`. Same hook, same reason, as the sequence
       * display past base resolution.
       *
       * Deliberately not spelled `!self.rendersCanvas`: "paints no canvas" and
       * "will never fetch" are independent axes that merely coincide here, and a
       * display could well do the first without the second. Keying both on the
       * slot keeps them independent while making the shared cause obvious.
       */
      get svgReadyExtraTerminal(): boolean {
        return !getConf(self, 'showLDTriangle')
      },
      get isPrecomputedLD() {
        return isPrecomputedLDAdapter(self.adapterConfig?.type)
      },
      /**
       * #getter
       * Metric the loaded data actually represents. A pre-computed file with no
       * D' column downgrades a 'dprime' request to 'r2', so the legend and the
       * metric radios read this rather than the raw requested `ldMetric`.
       */
      get effectiveLdMetric(): LDMetric {
        return self.rpcData?.metric ?? getConf(self, 'ldMetric')
      },
      /**
       * #getter
       * Whether the loaded matrix was actually laid out at genomic positions.
       * The worker falls back to uniform cells when the viewport holds more
       * than one region (SNPs from the later ones would collapse onto the
       * first's coordinates), so the raw slot can say yes while what is on
       * screen is index-laid-out. Every consumer that branches on the layout —
       * the hit test, the zone height, the connectors-vs-labels choice, the
       * recombination x axis — reads this, not the slot, or it describes a
       * matrix that isn't there. Same requested-vs-loaded split as
       * `effectiveLdMetric`; `rpcProps` still sends the slot, which is the
       * request.
       */
      get effectiveUseGenomicPositions(): boolean {
        return self.rpcData?.genomicMode ?? getConf(self, 'useGenomicPositions')
      },
      /**
       * #getter
       * Whether the D' metric can be shown — false only for a pre-computed file
       * lacking a DP column, which disables the D' option.
       */
      get dprimeAvailable(): boolean {
        return self.rpcData?.hasDprime ?? true
      },
      /**
       * #getter
       * How the loaded LD values were derived: 'phased' (exact haplotypic),
       * 'composite' (Weir estimate from unphased genotypes), or 'precomputed'
       * (read from a PLINK/ldmat file). Undefined until data loads.
       */
      get ldMethod(): LDMethod | undefined {
        return self.rpcData?.method
      },
      /**
       * #getter
       * Array index of the focal SNP in the current `snps`, or -1 if none is
       * selected or the locus is no longer present after a re-fetch.
       */
      get focalSnpIndex() {
        const locus = self.focalSnpLocus
        return locus === undefined
          ? -1
          : (self.rpcData?.snps ?? []).findIndex(
              s => `${s.refName}:${s.start}` === locus,
            )
      },
      /**
       * #getter
       * Opt into RegionTooLargeMixin's derived byte gate (byte axis only, no
       * density axis), except for pre-computed LD. `CoreGetRegionByteEstimate`
       * measures via `getFeatures`, which only the VCF-computed path's feature
       * adapter implements — a PlinkLD* adapter would throw "Adapter does not
       * support retrieving features", and it ships pre-thinned files that need
       * no gate anyway.
       */
      // `this`, not `self`: the sibling getter above is in this same block, so
      // `self` isn't typed with it yet
      get byteGateEnabled() {
        return !this.isPrecomputedLD
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Pixel height of the SVG zone above the canvas (variant labels +
       * lines, or recombination scale). The hit-test subtracts this from
       * mouseY before reversing the render transform.
       */
      // Index mode always reserves the zone -- that is where the connector
      // lines live. Genomic-positions mode draws no connectors, so it reserves
      // only what is actually turned on, and nothing at all when neither is:
      // the recombination plot at its own configured height, the labels at the
      // draggable `lineZoneHeight`. The labels are rotated text of unknown
      // extent, so the room for them is the user's to set, not ours to measure
      // -- but with no band at all they landed on top of the triangle.
      get effectiveLineZoneHeight() {
        return self.effectiveUseGenomicPositions
          ? Math.max(
              self.showRecombination ? self.recombinationZoneHeight : 0,
              self.showLabels ? self.lineZoneHeight : 0,
            )
          : self.lineZoneHeight
      },
      /**
       * #getter
       * Where the recombination plot sits inside that zone. Genomic-positions
       * mode gives it the whole band; index mode tucks it into the lower half,
       * under the connector lines. The live overlay and the SVG export place it
       * from this one pair — restating the branch in both is how the export
       * came to disagree with the screen about which mode was even loaded.
       */
      get recombinationZone() {
        return self.effectiveUseGenomicPositions
          ? { top: 0, height: this.effectiveLineZoneHeight }
          : { top: self.lineZoneHeight / 2, height: self.lineZoneHeight / 2 }
      },
      /**
       * #getter
       * Effective height for the LD canvas (total height minus the zone the
       * recombination overlay / variant lines occupy above the matrix).
       */
      get ldCanvasHeight() {
        return Math.max(50, self.height - this.effectiveLineZoneHeight)
      },
      /**
       * #getter
       * The box the triangle is drawn in. One pair for all three of the canvas
       * element's CSS size, the backing store the rendering backends resize to,
       * and the SVG export's paint layer — they have to be the same number or
       * the drawn matrix is stretched against the box it sits in, and they were
       * previously derived independently on either side of that boundary.
       * `totalWidthPxWithoutBorders` is the rounded content width, so this is
       * the drawn width even when the genome doesn't fill the viewport.
       */
      get canvasWidth() {
        return self.lgv.totalWidthPxWithoutBorders
      },
      /**
       * #getter
       * Height of that box: the triangle's natural apex height (half its
       * width), or the display's own height when squashed to fit.
       */
      get canvasHeight() {
        return self.squashToHeight ? this.ldCanvasHeight : this.canvasWidth / 2
      },
      /**
       * #getter
       * Per-frame yScalar squash factor. When squashToHeight is on, squashes
       * the natural (canvasWidth/2) triangle into ldCanvasHeight. Lives on
       * the main thread so resize doesn't trigger a worker re-fetch.
       */
      get yScalar() {
        return computeTriangleYScalar({
          squashToHeight: self.squashToHeight,
          displayHeight: this.ldCanvasHeight,
          triangleWidth: this.canvasWidth,
        })
      },

      // Literal RPC payload for RenderLDData. Adding a field here
      // automatically flows into both the RPC call (via the fetch autorun
      // in afterAttach.ts) and into mobx's dependency tracking — the
      // fetch autorun calls `self.rpcProps()` once, so any change to any
      // field refires it. No hand-enumerated fields at the top of the
      // autorun.
      rpcProps() {
        return {
          ldMetric: self.ldMetric,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
          hweFilterThreshold: self.hweFilterThreshold,
          callRateFilter: self.callRateFilter,
          jexlFilters: self.jexlFilters,
          signedLD: self.signedLD,
          useGenomicPositions: self.useGenomicPositions,
        }
      },
      /**
       * #getter
       * Per-frame render state for the GPU backend. Read by the upload/render
       * autorun — every change to any tracked observable (view.bpPerPx,
       * view.offsetPx, model.squashToHeight, rpcData contents, …) re-fires it.
       */
      // Resolved geometry, never undefined: it's pure view/settings state, and
      // "no data yet" is the render callback's gate. The two data-derived
      // fields (signedLD, uniformW) ride with the payload instead — see
      // LDUploadData.
      get renderState(): LDRenderState {
        const { scale, viewOffsetX } = self.renderTransform
        return {
          yScalar: this.yScalar,
          canvasWidth: this.canvasWidth,
          canvasHeight: this.canvasHeight,
          viewScale: scale,
          viewOffsetX,
        }
      },
      /**
       * #getter
       * The connector lines tying each matrix column to its SNP's genomic
       * position, in viewport pixels, plus the label the hover tooltip and
       * `VariantLabels` show. Only meaningful in index mode (genomic-positions
       * mode already draws columns at their genomic x).
       */
      // Horizontal flips need nothing here: the worker hands back `snps`
      // already in screen order (`RenderLDDataRPC/reversedRegions.ts`), so the
      // index axis and the genomic x agree.
      get connectorLineCoords(): ConnectorCoord[] {
        const view = self.lgv
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(view.assemblyNames[0]!)
        return assembly
          ? self.snps
              .map((snp, i) => {
                const gx = genomicViewportX(
                  view,
                  assembly,
                  snp.refName,
                  snp.start,
                )
                return gx === undefined
                  ? undefined
                  : { mx: this.columnX(i + 0.5), gx, label: snp.id }
              })
              .filter(coord => coord !== undefined)
          : []
      },
      /**
       * #method
       * Viewport x of a position on the matrix's column axis, in fractional
       * column indices: 0 is the triangle's left corner, `i + 0.5` the apex of
       * column i, `i + 1` the boundary between columns i and i+1. Index-mode
       * connector lines and the recombination curve both anchor through this.
       *
       * It rides the same forward transform the shader does — `cellWidth`
       * (uniformW) is the fetch-time cell width and `renderTransform` rescales
       * it to the live viewport, exactly like `hitTest` inverts it. Deriving
       * the column pitch from the *current* block width instead applies the
       * zoom twice, sliding everything anchored here off the triangle for the
       * whole debounce+RPC window after a zoom.
       */
      columnX(column: number) {
        const { scale, viewOffsetX } = self.renderTransform
        return column * self.cellWidth * Math.SQRT2 * scale + viewOffsetX
      },
      /**
       * #method
       * Viewport x of one locus, through the same `genomicViewportX` the
       * connector lines use. The crosshair ticks and the view's vertical
       * guides go through this rather than measuring off
       * `contentBlocks[0]`: that block's own left edge is only x=0 while the
       * content reaches the viewport edge, and a SNP in any *later* block
       * isn't measured against its own region at all. Undefined when the
       * locus has no on-screen x, which the caller drops rather than pinning
       * to 0.
       */
      locusViewportX(refName: string, coord: number): number | undefined {
        const view = self.lgv
        const assembly = getSession(self).assemblyManager.get(
          view.assemblyNames[0]!,
        )
        return assembly
          ? genomicViewportX(view, assembly, refName, coord)
          : undefined
      },
      /**
       * #getter
       * The recombination curve's points in viewport pixels, one per adjacent
       * SNP pair (`value` NaN where the pair is unmeasured, `x` NaN where the
       * locus is off-screen; the plot skips both and breaks its line across
       * the hole). Derived here rather than in the plot component for the same
       * reason as `connectorLineCoords`: index mode has to ride the matrix's
       * own frame — the fetch-time column pitch rescaled by `renderTransform`
       * — and a component that laid points out across the live width would
       * drift off the triangle by the left gap, and by the zoom factor for the
       * whole debounce+RPC window.
       */
      get recombinationCoords(): { x: number; value: number }[] {
        const rec = self.rpcData?.recombination
        if (!rec) {
          return []
        }
        const { values, positions } = rec
        const out: { x: number; value: number }[] = []
        if (self.effectiveUseGenomicPositions) {
          // assembly hoisted, not `locusViewportX` per point: this list runs to
          // one entry per adjacent SNP pair, and the lookup is the same for all
          // of them (same reason as `connectorLineCoords`)
          const view = self.lgv
          const assembly = getSession(self).assemblyManager.get(
            view.assemblyNames[0]!,
          )
          for (let i = 0; i < values.length; i++) {
            // positions[i] is the bp midpoint of the pair (i, i+1), so it is
            // on the left SNP's refName
            const x = assembly
              ? genomicViewportX(
                  view,
                  assembly,
                  self.snps[i]!.refName,
                  positions[i]!,
                )
              : undefined
            out.push({ x: x ?? Number.NaN, value: values[i]! })
          }
        } else {
          for (let i = 0; i < values.length; i++) {
            // the boundary between columns i and i+1, which is where the pair
            // they measure sits
            out.push({ x: this.columnX(i + 1), value: values[i]! })
          }
        }
        return out
      },
      /**
       * #getter
       * Top of the recombination plot's y axis. One number for the curve and
       * its scale bar so they can't label different scales; `maxFinite`
       * because unmeasured pairs are NaN.
       */
      get recombinationMax(): number {
        return maxFinite(self.rpcData?.recombination?.values ?? [], 0.1)
      },
      /**
       * #method
       * Forward transform of the LD matrix, paired with `hitTest` below (its
       * exact inverse): pre-rotation cell coordinates to canvas-relative
       * pixels. The overlays that decorate individual cells — the hover
       * crosshair, the focal-SNP band — place themselves through this, so
       * they land on the cells the shader drew and move with the same rescale
       * during the debounce+RPC window.
       */
      cellToScreen(x: number, y: number) {
        const { scale, viewOffsetX } = self.renderTransform
        return {
          x: ((x + y) / Math.SQRT2) * scale + viewOffsetX,
          y:
            ((y - x) / Math.SQRT2) * scale * this.yScalar +
            this.effectiveLineZoneHeight,
        }
      },
      /**
       * #method
       * Inverse of `renderTransform` for the LD matrix: takes mouse coords
       * (canvas-relative) and returns the LD cell under the cursor, or
       * undefined. Mirrors plugins/hic's `hitTest` so both contact maps
       * keep the forward and inverse transforms paired on the model.
       */
      hitTest(mouseX: number, mouseY: number): LDFlatbushItem | undefined {
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        if (mouseY < this.effectiveLineZoneHeight) {
          return undefined
        }
        const { scale, viewOffsetX } = self.renderTransform
        const dataX = (mouseX - viewOffsetX) / scale
        const dataY = (mouseY - this.effectiveLineZoneHeight) / scale
        // Reverse the rendering's `scale(1, yScalar) · rotate(-π/4)` then
        // pick the cell. yScalar squashes Y, so divide it out before
        // un-rotating.
        const scaledY = dataY / this.yScalar
        const x = (dataX - scaledY) / Math.SQRT2
        const y = (dataX + scaledY) / Math.SQRT2
        const { boundaries, ldValues } = data
        const n = boundaries.length - 1
        let hitI = -1
        let hitJ = -1
        if (self.effectiveUseGenomicPositions) {
          hitJ = upperBoundFloat32(boundaries, x) - 1
          hitI = upperBoundFloat32(boundaries, y) - 1
        } else {
          const w = self.cellWidth
          if (w > 0) {
            hitJ = Math.floor(x / w)
            hitI = Math.floor(y / w)
          }
        }
        if (hitI > hitJ && hitI > 0 && hitJ >= 0 && hitI < n) {
          const ldIdx = (hitI * (hitI - 1)) / 2 + hitJ
          return {
            i: hitI,
            j: hitJ,
            ldValue: ldValues[ldIdx]!,
            snp1: self.snps[hitI]!,
            snp2: self.snps[hitJ]!,
          }
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Starts the upload/render autorun. No upload-diffing helper here on
       * purpose: matrix and color ramp both derive from the one `rpcData`
       * object, so the upload autorun's whole dependency set is that field and
       * it can't re-fire without both genuinely being stale. (HiC needs
       * `createGlobalUploadSync` because its palette is a config slot with an
       * input independent of the RPC result.)
       */
      startRenderingBackend(backend: LDRenderingBackend) {
        self.attachRenderingBackend<LDRenderingBackend>(backend, {
          upload: b => {
            const d = self.rpcData
            if (d) {
              b.uploadData(toLDUploadData(d))
              b.uploadColorRamp(generateLDColorRamp(d.metric, d.signedLD))
            }
          },
          // Gates on the data, not on a nullable render state: a monolithic
          // `render` returns void, so this callback owns the "did real content
          // reach the canvas" answer, and painting an empty frame would flip
          // `canvasDrawn` before the first matrix arrives (see the matrix
          // display for the same note).
          render: b => {
            const d = self.rpcData
            if (d) {
              b.render(toLDUploadData(d), self.renderState)
              return true
            } else {
              return false
            }
          },
        })
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         * How much room the SVG export's container reserves to the right of
         * the plot for this display's legend (it maxes this across tracks).
         */
        svgLegendWidth(): number {
          return self.showLegend ? GRADIENT_LEGEND_SVG_AREA_WIDTH : 0
        },
        /**
         * #method
         */
        trackMenuItems() {
          // One shared sentence describing how the loaded values were derived,
          // reused across the R²/D' help so precision is stated honestly.
          const computeNote =
            self.ldMethod === 'phased'
              ? 'Computed from phased genotypes as exact haplotypic LD.'
              : self.ldMethod === 'precomputed'
                ? 'Read directly from the pre-computed LD file.'
                : 'Estimated from unphased genotypes with the composite (Weir) method.'
          const plinkNote = self.isPrecomputedLD
            ? ''
            : ' For authoritative published LD, load PLINK-computed .ld files via the PLINK adapter.'
          return [
            ...superTrackMenuItems(),
            ...(self.focalSnpIndex >= 0
              ? [
                  {
                    label: 'Clear focal SNP highlight',
                    onClick: () => {
                      self.setFocalSnp(undefined)
                    },
                  },
                ]
              : []),
            {
              label: 'LD metric',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'R² (squared correlation)',
                  type: 'radio',
                  checked: self.effectiveLdMetric === 'r2',
                  helpText: `Squared correlation between the two variants (0-1). ${computeNote}${plinkNote}`,
                  onClick: () => {
                    self.setLDMetric('r2')
                  },
                },
                {
                  label: "D' (normalized D)",
                  type: 'radio',
                  checked: self.effectiveLdMetric === 'dprime',
                  disabled: !self.dprimeAvailable,
                  helpText: self.dprimeAvailable
                    ? `Lewontin's normalized D (0-1). ${computeNote}${
                        self.isPrecomputedLD
                          ? ''
                          : ' The composite estimate from unphased data can differ slightly from EM-based tools like Haploview.'
                      }${plinkNote}`
                    : "This LD file has no D' (DP) column",
                  onClick: () => {
                    self.setLDMetric('dprime')
                  },
                },
                // Signed LD modifies the chosen metric (R instead of R²,
                // signed D'), so it belongs with the metric choice rather than
                // the visibility toggles. VCF-computed LD only.
                ...(self.isPrecomputedLD
                  ? []
                  : [
                      checkboxItem(
                        'Show signed LD values (-1 to 1)',
                        self.signedLD,
                        () => {
                          self.setSignedLD(!self.signedLD)
                        },
                        {
                          helpText:
                            "When enabled, shows R (correlation) instead of R², and preserves the sign of D'. Positive values indicate alleles tend to co-occur (coupling), negative values indicate alleles tend to be on different haplotypes (repulsion).",
                        },
                      ),
                    ]),
              ],
            },
            {
              label: 'Show...',
              icon: VisibilityIcon,
              type: 'subMenu',
              subMenu: [
                checkboxItem('Show LD triangle', self.showLDTriangle, () => {
                  self.setShowLDTriangle(!self.showLDTriangle)
                }),
                checkboxItem(
                  'Show recombination track',
                  self.showRecombination,
                  () => {
                    self.setShowRecombination(!self.showRecombination)
                  },
                  {
                    helpText:
                      'Displays 1-r² between neighboring SNPs only (not all pairwise comparisons). Peaks indicate haplotype block boundaries where historical recombination has broken down LD between adjacent variants.',
                  },
                ),
                checkboxItem('Show legend', self.showLegend, () => {
                  self.setShowLegend(!self.showLegend)
                }),
                checkboxItem('Show variant labels', self.showLabels, () => {
                  self.setShowLabels(!self.showLabels)
                }),
                checkboxItem(
                  'Show vertical guides on hover',
                  self.showVerticalGuides,
                  () => {
                    self.setShowVerticalGuides(!self.showVerticalGuides)
                  },
                ),
                // Layout toggles live alongside the visibility toggles in
                // this submenu, matching the Hi-C triangular display's
                // "Show..." grouping (plugins/hic trackMenuItems.ts) so the
                // two contact-map displays stay consistent — the fit-to-height
                // row is literally the same builder they share.
                squashToHeightCheckboxItem(self),
                checkboxItem(
                  'Show cells with genome proportions',
                  self.useGenomicPositions,
                  () => {
                    self.setUseGenomicPositions(!self.useGenomicPositions)
                  },
                  {
                    helpText:
                      'By default each cell is equal width (one column per variant). Enable to size cells proportional to the genomic distance between variants.',
                  },
                ),
              ],
            },
            // Filters act on the genotypes LD is computed from, so a
            // pre-computed file — already thinned by whatever produced it — has
            // nothing here to filter and shows no menu at all
            ...(self.isPrecomputedLD
              ? []
              : [
                  {
                    label: 'Filter by...',
                    icon: ClearAllIcon,
                    type: 'subMenu',
                    subMenu: [
                      {
                        label: 'LD-specific filters...',
                        onClick: () => {
                          getSession(self).queueDialog(handleClose => [
                            LDFilterDialog,
                            { model: self, handleClose },
                          ])
                        },
                      },
                      {
                        label: 'General JEXL filters...',
                        onClick: () => {
                          getSession(self).queueDialog(handleClose => [
                            AddFiltersDialog,
                            { model: self, handleClose },
                          ])
                        },
                      },
                    ],
                  },
                ]),
          ]
        },

        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as SharedLDModel, opts)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Re-fetches LD matrix for the current viewport. Driven by the
       * `afterAttach` autorun; `reload()` reaches it by bumping
       * `reloadCounter`, which that autorun tracks.
       */
      async performLDFetch() {
        if (self.isMinimized) {
          return
        }
        const view = self.lgv
        if (!view.initialized) {
          return
        }
        const regions = view.dynamicBlocks.contentBlocks
        if (!self.showLDTriangle || self.regionTooLarge || !regions.length) {
          return
        }
        // Capture the viewport this fetch is issued for. `setLastDrawnViewport`
        // below must record *these* values, not a live re-read: `ctx.isStale()`
        // only trips on a newer fetch or a cancel, so a pan/zoom during the RPC
        // would otherwise stamp the new viewport onto a matrix packed for the
        // old one — `renderTransform` would then read scale 1 and leave the
        // stale pixels un-rescaled, and the freshness getter above (and so
        // `svgReady`) would call them current.
        const { bpPerPx, offsetPx } = view
        const { adapterConfig } = self
        await self.runFetch(async ctx => {
          const { rpcManager } = getSession(self)
          const sessionId = getRpcSessionId(self)
          // RegionTooLargeMixin's shared pre-flight gate (a no-op when
          // `byteGateEnabled` is off), called directly because LD fetches
          // through GlobalFetchMixin rather than MultiRegionDisplayMixin's
          // fetchRegions
          if (await self.byteGateBlocksFetch([...regions], ctx)) {
            return
          }

          const result = await rpcManager.call(
            sessionId,
            'RenderLDData',
            {
              adapterConfig,
              regions: [...regions],
              bpPerPx,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
            },
            {
              statusCallback: self.makeStatusCallback(),
            },
          )
          if (ctx.isStale()) {
            return
          }
          self.setRpcData(result)
          self.setLastDrawnViewport(offsetPx, bpPerPx)
        })
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
          } catch (e) {
            console.error(e)
            getSession(self).notifyError(`${e}`, e)
          }
        })()
      },
    }))
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>
