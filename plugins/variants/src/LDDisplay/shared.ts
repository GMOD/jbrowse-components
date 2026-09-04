import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { reservedPx } from '@jbrowse/core/util/bandLayout'
import {
  activeJexlFilters,
  configuredJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin, {
  gradientSvgLegendWidth,
} from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  triangleDataToScreen,
  triangleScreenToData,
  triangleViewTransform,
} from '@jbrowse/display-kit/triangleTransform'
import { computeTriangleYScalar } from '@jbrowse/display-kit/triangleYScalar'
import { ldValueComputed } from '@jbrowse/ld-core'
import { cast, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'

import { isPrecomputedLDAdapter } from '../RenderLDDataRPC/types.ts'
import { bandPairIndex } from '../VariantRPC/ldBand.ts'
import { clampLineZoneHeight } from '../shared/constants.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { generateLDColorRamp } from './components/ldColorRamp.ts'
import { toLDUploadData } from './components/ldRenderingBackendTypes.ts'
import { buildLDTrackMenuItems } from './trackMenuItems.ts'

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
  LDCellKey,
  LDRenderState,
  LDRenderingBackend,
} from './components/ldRenderingBackendTypes.ts'
import type { LDRpcProps } from './ldFetchPhases.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
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
 * #displayFoundation GlobalFetchMixin
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
      GlobalFetchMixin(),
      LegendMixin(),
      types.model({
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Runtime "General JEXL filters..." override, already `jexl:`-prefixed.
         * When set (even to an empty list) it replaces the `jexlFilters` config
         * slot; when undefined the config default applies. The two-tier contract
         * every display with this row implements — see `JexlFilterModel`.
         */
        jexlFiltersSetting: types.maybe(types.array(types.string)),
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
      /**
       * #action
       * The shared commit stamps the signature this was fetched for
       * (`GlobalFetchMixin.commitFetchResult`) in the same transaction.
       */
      setRpcData(data: LDDataResult) {
        self.rpcData = data
      },
      setFocalSnp(snp: LDSnp | undefined) {
        self.focalSnpLocus = snp ? `${snp.refName}:${snp.start}` : undefined
      },
      setLineZoneHeight(n: number) {
        // `getConf`, not the `lineZoneHeight` getter, which is declared in a
        // later views block and so is not on `self` here — same value either way
        setConf(
          self,
          'lineZoneHeight',
          clampLineZoneHeight(getConf(self, 'lineZoneHeight'), n),
        )
      },
      setMafFilter(arg: number) {
        setConf(self, 'minorAlleleFrequencyFilter', arg)
      },
      setLDMetric(metric: LDMetric) {
        setConf(self, 'ldMetric', metric)
      },
      setShowLDTriangle(show: boolean) {
        setConf(self, 'showLDTriangle', show)
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
      setJexlFilters(filters?: string[]) {
        self.jexlFiltersSetting = cast(filters)
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
      get showLDTriangle() {
        return getConf(self, 'showLDTriangle')
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
      get maxVariantSeparation() {
        return getConf(self, 'maxVariantSeparation')
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
      /**
       * #getter
       * Which estimator the `ldMethod` config slot ASKS for. Named apart from
       * `ldMethod` below, which is what the RPC actually ran — they differ
       * whenever the request cannot be honoured ('phased' on unphased data) and
       * whenever 'auto' resolves.
       */
      get configuredLDMethod() {
        return getConf(self, 'ldMethod')
      },
      /**
       * #method
       * What the `jexlFilters` config slot alone declares, `jexl:`-prefixed.
       * Prefixing on read is what makes a config-declared filter work at all —
       * the slot stores them unprefixed (deferred evaluation) and
       * `stringToJexlExpression` throws on anything else, so before this an
       * admin following the slot's own documented convention got a worker
       * exception.
       */
      configuredFilters(): string[] {
        return configuredJexlFilters(self)
      },
      /**
       * #getter
       * The loaded matrix's SNPs, in the order they are drawn along the column
       * axis (the worker puts them in screen order — see
       * `RenderLDDataRPC/reversedRegions.ts`). Empty until data arrives.
       */
      get snps(): LDSnp[] {
        return self.rpcData?.snps ?? []
      },
      /**
       * #getter
       * Fetch-time width of one column in the un-rotated frame (`uniformW`).
       * Read through `columnX`, which rescales it to the live viewport.
       */
      get cellWidth() {
        return self.rpcData?.uniformW ?? 0
      },
      get filterStats(): FilterStats | undefined {
        return self.rpcData?.filterStats
      },
      /**
       * #getter
       * LD's half of `GlobalFetchMixin`'s freshness compare: the dynamic-block
       * set. LD's SNP set is viewport-defined (the index-mode triangle spans
       * the visible blocks), so a pan refetches — but worker output is genomic,
       * so the stale triangle draws at its own position under the live
       * transform while the refetch runs. The settings axis — what keeps
       * `svgReady` from capturing a matrix computed under the filters the user
       * just changed — rides in through the `rpcPropsCacheKey` half the mixin
       * appends.
       */
      get viewSignature(): string | undefined {
        return self.dynamicBlockSignature
      },
      /**
       * #getter
       * With the triangle off the display shows an EmptyState ("Enable LD
       * triangle…") instead of a canvas and its `prepare` declines forever, so
       * nothing is loading and nothing ever will. Every reader needs that: the
       * scrim would otherwise park over the placeholder — permanently, once a
       * cancel has been clicked, since `fetchCanceled` is durable —
       * `awaitSvgReady` is an unbounded `when`, so one such track hangs the
       * whole view's SVG export, and `canvasDrawn` never flips, so `painted`
       * reads off this through the foundation's `rendersCanvas`.
       */
      // reads the slot rather than the sibling `showLDTriangle` getter: that one
      // lives in this same `.views()` block, where `self` isn't yet typed with
      // it (see BaseLinearDisplay/CLAUDE.md on block-local `self` typing)
      get fetchInert(): boolean {
        return !getConf(self, 'showLDTriangle')
      },
      /**
       * #getter
       * True when this display reads LD out of a file (PLINK, ldmat) rather
       * than computing it from a VCF's genotypes — which decides the fetch
       * path, whether the filter menus mean anything, and whether the byte gate
       * has a `getFeatures` to measure with.
       */
      get isPrecomputedLD() {
        return isPrecomputedLDAdapter(self.adapterConfig.type)
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
       * Whether the loaded values actually carry a sign. Reads the packed
       * matrix rather than the slot for the same reason as `effectiveLdMetric`:
       * a pre-computed file states magnitudes and cannot honor the request, so
       * a track configured `signedLD: true` against one would otherwise get a
       * legend reading -1..1 and a tooltip calling r² "R" over 0..1 values. The
       * cells already follow the data (the ramp is built from `rpcData`).
       */
      get effectiveSignedLD(): boolean {
        return self.rpcData?.signedLD ?? getConf(self, 'signedLD')
      },
      /**
       * #getter
       * Whether the loaded matrix was actually laid out at genomic positions.
       * The worker falls back to uniform cells when the viewport holds more
       * than one region (SNPs from the later ones would collapse onto the
       * first's coordinates), so the raw slot can say yes while what is on
       * screen is index-laid-out. Every consumer that branches on the layout —
       * the hit test, the zone height, the connectors-vs-labels choice — reads
       * this, not the slot, or it describes a
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
       * (read from a PLINK/ldmat file). Undefined until data loads. This is
       * what RAN, which is not always what `configuredLDMethod` asked for.
       */
      get ldMethod(): LDMethod | undefined {
        return self.rpcData?.method
      },
      /**
       * #getter
       * The pair-separation window the LOADED matrix was computed at, in
       * variants, or undefined when it covers the whole triangle. Read off the
       * result rather than off `maxVariantSeparation`, for the same reason
       * `ldMethod` is: the slot is a request, and `resolveBand` clamps it to
       * `n - 1`, at which point there is no window to report.
       *
       * The status bar names it because nothing else on screen can. A pair past
       * the window is not drawn, and an in-band pair at r² = 0 is painted at the
       * ramp's white end at full alpha — so against a light theme's background
       * "not measured" and "no linkage" are the same pixel, and long-range LD,
       * which is the interesting case, reads as absent rather than as unasked.
       */
      get loadedLDWindow(): number | undefined {
        const data = self.rpcData
        return data && data.band > 0 && data.band < data.snps.length - 1
          ? data.band
          : undefined
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
       * density axis). On for every adapter, including the pre-computed ones
       * (PlinkLD*), which serve no features at all: `RenderLDData` measures the
       * genotype adapter it is about to read and skips those entirely, so they
       * report no bytes — "unmeasurable", the same answer a BigWig gives — and
       * an unmeasurable estimate keeps the byte axis out of the verdict without
       * anything here having to know which adapter it has.
       *
       * This is the last display-side answer to an adapter-side question to go
       * — the same shape as the `alwaysRender` estimate flag that preceded it —
       * so the opt-in has no "except when the adapter would explode" caveat
       * anywhere in the tree. It used to cost one pre-flight round trip per
       * pre-computed fetch, returning undefined by construction; folded into
       * the fetch, it costs nothing at all.
       */
      get gateEnabled() {
        return true
      },
    }))
    .views(self => ({
      /**
       * #method
       * The filters actually applied, `jexl:`-prefixed: the runtime override
       * when set, otherwise the config tier. In its own block after
       * `configuredFilters` so it reaches it through `self`, the arrangement
       * `LinearBasicDisplay` uses for the same pair.
       */
      activeFilters(): string[] {
        return activeJexlFilters(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Pixel height of the SVG zone above the canvas (variant labels +
       * lines). The hit-test subtracts this from mouseY before reversing the
       * render transform.
       */
      // Index mode always reserves the zone -- that is where the connector
      // lines live. Genomic-positions mode draws no connectors, so it reserves
      // the labels' draggable `lineZoneHeight` when they are on and nothing at
      // all when they are off. The labels are rotated text of unknown extent,
      // so the room for them is the user's to set, not ours to measure -- but
      // with no band at all they landed on top of the triangle.
      get effectiveLineZoneHeight() {
        return reservedPx({
          active: !self.effectiveUseGenomicPositions || self.showLabels,
          height: self.lineZoneHeight,
        })
      },
      /**
       * #getter
       * Effective height for the LD canvas (total height minus the zone the
       * variant lines occupy above the matrix).
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
        return self.view.totalWidthPxWithoutBorders
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
      // automatically flows into both the RPC call and the refetch trigger:
      // the global fetch skeleton tracks the *serialized* payload
      // (`installGlobalFetchAutorun`'s computed over `serializeRpcProps`), so
      // a change to any returned field refires the fetch while a read the
      // payload doesn't return cannot. No hand-enumerated fields at the top of
      // the autorun.
      //
      // Annotated, not inferred: the annotation is what makes a field the RPC
      // does not declare an excess-property error here rather than a value the
      // worker never sees.
      rpcProps(): LDRpcProps {
        return {
          ldMetric: self.ldMetric,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
          hweFilterThreshold: self.hweFilterThreshold,
          callRateFilter: self.callRateFilter,
          maxVariantSeparation: self.maxVariantSeparation,
          jexlFilters: self.activeFilters(),
          signedLD: self.signedLD,
          ldMethod: self.configuredLDMethod,
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
        const { viewScale, viewOffsetX } = this.viewTransform
        return {
          yScalar: this.yScalar,
          canvasWidth: this.canvasWidth,
          canvasHeight: this.canvasHeight,
          viewScale,
          viewOffsetX,
        }
      },
      /**
       * #getter
       * The per-frame map from the payload's pre-rotation data space to canvas
       * px; `triangleViewTransform` owns the arithmetic and says why.
       */
      get viewTransform() {
        return triangleViewTransform(self.host, self.rpcData)
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
        const locusX = locusViewportXFor(self)
        return self.snps
          .map((snp, i) => {
            const gx = locusX(snp.refName, snp.start)
            return gx === undefined
              ? undefined
              : { mx: this.columnX(i + 0.5), gx, label: snp.id }
          })
          .filter(coord => coord !== undefined)
      },
      /**
       * #method
       * Viewport x of a position on the matrix's column axis, in fractional
       * column indices: 0 is the triangle's left corner, `i + 0.5` the apex of
       * column i, `i + 1` the boundary between columns i and i+1. The
       * index-mode connector lines anchor through this.
       *
       * It rides the same forward transform the shader does — `cellWidth`
       * (uniformW) is the payload's cell span in bp and `viewTransform` maps it
       * to the live viewport, exactly like `hitTest` inverts it. Deriving the
       * column pitch from the *current* block width instead applies the zoom
       * twice, sliding everything anchored here off the triangle for the whole
       * debounce+RPC window after a zoom.
       */
      columnX(column: number) {
        const { viewScale, viewOffsetX } = this.viewTransform
        return column * self.cellWidth * Math.SQRT2 * viewScale + viewOffsetX
      },
      /**
       * #method
       * Viewport x of one locus, through the same `locusViewportXFor` the
       * connector lines use. The crosshair ticks and the view's vertical
       * guides go through this rather than measuring off
       * `contentBlocks[0]`: that block's own left edge is only x=0 while the
       * content reaches the viewport edge, and a SNP in any *later* block
       * isn't measured against its own region at all. Undefined when the
       * locus has no on-screen x, which the caller drops rather than pinning
       * to 0.
       */
      locusViewportX(refName: string, coord: number): number | undefined {
        return locusViewportXFor(self)(refName, coord)
      },
      /**
       * #getter
       * The whole triangle map as the shared `TriangleTransform`: the view
       * scale/offset, the fit-to-height squash, and the connector zone LD
       * reserves above the matrix. One value, so `cellToScreen` and
       * `screenToCell` below cannot disagree about a term — a dropped
       * `yScalar` in a hand-spelled inverse survived the coarse round-trip
       * test here once.
       */
      get triangleTransform() {
        return {
          ...this.viewTransform,
          yScalar: this.yScalar,
          yOffsetPx: this.effectiveLineZoneHeight,
        }
      },
      /**
       * #method
       * Forward transform of the LD matrix (`triangleDataToScreen`), paired
       * with `hitTest` below (its exact inverse): pre-rotation cell
       * coordinates to canvas-relative pixels. The overlays that decorate
       * individual cells — the hover crosshair, the focal-SNP band — place
       * themselves through this, so they land on the cells the shader drew and
       * move with the same rescale during the debounce+RPC window.
       */
      cellToScreen(x: number, y: number) {
        return triangleDataToScreen(x, y, this.triangleTransform)
      },
      /**
       * #method
       * The exact inverse of `cellToScreen` (`triangleScreenToData`), split
       * out of `hitTest` so the pair is checkable as an **identity** rather
       * than only through the cell it lands in — `overlayCoords.test.ts`
       * asserts coordinates, which is what catches a dropped term.
       */
      screenToCell(mouseX: number, mouseY: number) {
        const { ux, uy } = triangleScreenToData(
          mouseX,
          mouseY,
          this.triangleTransform,
        )
        return { x: ux, y: uy }
      },
      /**
       * #method
       * Takes mouse coords (canvas-relative) and returns the LD cell under the
       * cursor, or undefined: `screenToCell` above, then the boundary walk.
       * Mirrors plugins/hic's `hitTest` so both contact maps keep the forward
       * and inverse transforms paired on the model.
       */
      hitTest(mouseX: number, mouseY: number): LDFlatbushItem | undefined {
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        if (mouseY < this.effectiveLineZoneHeight) {
          return undefined
        }
        const { x, y } = this.screenToCell(mouseX, mouseY)
        const { boundaries, ldValues, band } = data
        const n = boundaries.length - 1
        // One search for both layouts: uniform mode's boundaries ARE
        // `i * uniformW`, so the division it used to do here is what this
        // binary search already answers — and dividing by `uniformW` while the
        // renderers walked `boundaries` left two ways to say which cell a pixel
        // is in. Out-of-range x or y lands outside [0, n) and falls through the
        // guard below.
        const hitJ = upperBoundFloat32(boundaries, x) - 1
        const hitI = upperBoundFloat32(boundaries, y) - 1
        // A pair outside the band was never computed and is not drawn, so
        // there is nothing under the cursor there — `bandPairIndex` says -1
        // rather than this restating the layout, which is the fourth hand-copy
        // of the index formula this used to be.
        const ldIdx =
          hitI > hitJ && hitI > 0 && hitJ >= 0 && hitI < n
            ? bandPairIndex(hitI, hitJ, band)
            : -1
        // A slot the layout has but no estimator filled is unpainted for the
        // same reason it is untooltipped: `applyDisplayOrder` can put a pair
        // inside the screen-order band that the source-order band skipped.
        return ldIdx < 0 || !ldValueComputed(ldValues[ldIdx]!)
          ? undefined
          : {
              i: hitI,
              j: hitJ,
              ldValue: ldValues[ldIdx]!,
              snp1: self.snps[hitI]!,
              snp2: self.snps[hitJ]!,
            }
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
        installUpload(self, backend, {
          // Both cells encode off the one fetch result, so both re-upload on a
          // new fetch and neither on anything else.
          cells: () => {
            const cells = new Map<LDCellKey, LDDataResult>()
            if (self.rpcData) {
              cells.set('data', self.rpcData)
              cells.set('colorRamp', self.rpcData)
            }
            return cells
          },
          encode: (d, _props, key) =>
            key === 'colorRamp'
              ? generateLDColorRamp(d.metric, d.signedLD)
              : toLDUploadData(d),
          // The backend answers "did real content reach the canvas". It used to
          // be this callback's answer, because a monolithic `render` returned
          // void — and "the data is here" is not the same claim as "something
          // was painted": the Canvas2D renderer draws nothing until the colour
          // ramp arrives, and the GPU one nothing until a buffer is filled.
          render: b =>
            b.render(
              self.rpcData ? toLDUploadData(self.rpcData) : null,
              self.renderState,
            ),
        })
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         * How much room the SVG export's container reserves to the right of
         * the plot for this display's legend (it maxes this across tracks),
         * via the shared helper — see `gradientSvgLegendWidth` for why it
         * reserves on the setting alone.
         */
        svgLegendWidth(): number {
          return gradientSvgLegendWidth(self)
        },
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
          return renderSvg(self as SharedLDModel, opts)
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        runLazyAfterAttach(
          self,
          async () => (await import('./afterAttach.ts')).doAfterAttach,
        )
      },
    }))
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>
