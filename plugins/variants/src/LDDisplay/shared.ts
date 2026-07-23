import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
  computeRenderTransform,
  computeTriangleYScalar,
  viewportMatchesLastDrawn,
} from '@jbrowse/plugin-linear-genome-view'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { PRECOMPUTED_LD_ADAPTERS } from '../RenderLDDataRPC/types.ts'
import AddFiltersDialog from '../shared/components/AddFiltersDialog.tsx'
import LDFilterDialog from '../shared/components/LDFilterDialog.tsx'
import { generateLDColorRamp } from './components/ldColorRamp.ts'

import type { LDDataResult, LDFlatbushItem } from '../RenderLDDataRPC/types.ts'
import type {
  FilterStats,
  LDMethod,
  LDMetric,
  LDSnp,
} from '../VariantRPC/getLDMatrix.ts'
import type { LDDisplayConfigSchema } from './SharedLDConfigSchema.ts'
import type { LDRenderingBackend } from './components/ldRenderingBackendTypes.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
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
  return (
    types
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
          self.configuration.setSlot('lineZoneHeight', Math.max(0, n))
        },
        setMafFilter(arg: number) {
          self.configuration.setSlot('minorAlleleFrequencyFilter', arg)
        },
        setLDMetric(metric: LDMetric) {
          self.configuration.setSlot('ldMetric', metric)
        },
        setShowLegend(show: boolean) {
          self.configuration.setSlot('showLegend', show)
        },
        setShowLDTriangle(show: boolean) {
          self.configuration.setSlot('showLDTriangle', show)
        },
        setShowRecombination(show: boolean) {
          self.configuration.setSlot('showRecombination', show)
        },
        setFitToHeight(value: boolean) {
          self.configuration.setSlot('fitToHeight', value)
        },
        setHweFilter(threshold: number) {
          self.configuration.setSlot('hweFilterThreshold', threshold)
        },
        setCallRateFilter(threshold: number) {
          self.configuration.setSlot('callRateFilter', threshold)
        },
        setShowVerticalGuides(show: boolean) {
          self.configuration.setSlot('showVerticalGuides', show)
        },
        setShowLabels(show: boolean) {
          self.configuration.setSlot('showLabels', show)
        },
        setUseGenomicPositions(value: boolean) {
          self.configuration.setSlot('useGenomicPositions', value)
        },
        setSignedLD(value: boolean) {
          self.configuration.setSlot('signedLD', value)
        },
        setJexlFilters(filters: string[] | undefined) {
          self.configuration.setSlot('jexlFilters', filters)
        },
      }))
      // Opt into RegionTooLargeMixin's shared derived byte gate: the too-large
      // banner becomes a pure function of the cached estimate scaled to the
      // current viewport (self-releases on zoom-in, no flicker on pan). Set
      // explicitly (not derived from getByteEstimateConfig like the
      // MultiRegionDisplayMixin displays) because LD captures the estimate in its
      // own performLDFetch; afterAttach clears it on chromosome nav. Byte-only —
      // no density axis.
      .views(() => ({
        /**
         * #getter
         */
        get derivedRegionTooLargeEnabled() {
          return true
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
        get fitToHeight() {
          return getConf(self, 'fitToHeight')
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
         * Global-display data-loaded signal read by `GlobalDataDisplayMixin.svgReady`
         * (analog of `viewportWithinLoadedData`). The fetch commits `rpcData` even
         * for an empty viewport, so this flips true once data has loaded AND that
         * data was fetched for the current viewport. Gating on freshness — not
         * merely `rpcData !== null` — keeps off-screen `svgReady` from resolving on
         * data left over from the pre-pan/zoom viewport during the debounced-refetch
         * window (`setLastDrawnViewport` runs right after `setRpcData`). Without the
         * override the mixin default (`false`) leaves `svgReady` unable to resolve
         * on a successful load, hanging SVG export.
         */
        get dataLoaded(): boolean {
          const view = getContainingView(self) as LinearGenomeViewModel
          return (
            self.rpcData !== null &&
            viewportMatchesLastDrawn({
              lastDrawnOffsetPx: self.lastDrawnOffsetPx,
              lastDrawnBpPerPx: self.lastDrawnBpPerPx,
              viewOffsetPx: view.offsetPx,
              viewBpPerPx: view.bpPerPx,
            })
          )
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
        get rendersCanvas(): boolean {
          return getConf(self, 'showLDTriangle')
        },
        get isPrecomputedLD() {
          return (PRECOMPUTED_LD_ADAPTERS as readonly string[]).includes(
            self.adapterConfig?.type,
          )
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
      }))
      .views(self => ({
        /**
         * #getter
         * Pixel height of the SVG zone above the canvas (variant labels +
         * lines, or recombination scale). The hit-test subtracts this from
         * mouseY before reversing the render transform.
         */
        get effectiveLineZoneHeight() {
          if (self.useGenomicPositions) {
            return self.showRecombination ? self.recombinationZoneHeight : 0
          }
          return self.lineZoneHeight
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
         * Per-frame yScalar squash factor. When fitToHeight is on, squashes
         * the natural (canvasWidth/2) triangle into ldCanvasHeight. Lives on
         * the main thread so resize doesn't trigger a worker re-fetch.
         */
        get yScalar() {
          const view = getContainingView(self) as LinearGenomeViewModel
          return computeTriangleYScalar({
            fitToHeight: self.fitToHeight,
            displayHeight: this.ldCanvasHeight,
            triangleWidth: view.dynamicBlocks.totalWidthPxWithoutBorders,
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
         * Forward transform { scale, viewOffsetX } shared by GPU render,
         * mouse hit-test, and the matrix→genomic-position SVG lines. See
         * `computeRenderTransform` for the math.
         */
        get renderTransform() {
          const view = getContainingView(self) as LinearGenomeViewModel
          return computeRenderTransform({
            lastDrawnOffsetPx: self.lastDrawnOffsetPx,
            lastDrawnBpPerPx: self.lastDrawnBpPerPx,
            viewOffsetPx: view.offsetPx,
            viewBpPerPx: view.bpPerPx,
          })
        },
        /**
         * #getter
         * Per-frame render state for the GPU backend. Read by the upload/render
         * autorun — every change to any tracked observable (view.bpPerPx,
         * view.offsetPx, model.fitToHeight, rpcData contents, …) re-fires it.
         */
        get renderState() {
          const view = getContainingView(self) as LinearGenomeViewModel
          const data = self.rpcData
          if (!data) {
            return undefined
          }
          const { scale, viewOffsetX } = this.renderTransform
          const canvasWidth = Math.round(
            view.dynamicBlocks.totalWidthPxWithoutBorders,
          )
          return {
            yScalar: this.yScalar,
            canvasWidth,
            canvasHeight: self.fitToHeight
              ? this.ldCanvasHeight
              : canvasWidth / 2,
            signedLD: data.signedLD,
            viewScale: scale,
            viewOffsetX,
            uniformW: data.uniformW,
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
          const { scale, viewOffsetX } = this.renderTransform
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
          if (self.useGenomicPositions) {
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
         * Starts the upload/render autorun. Data + color ramp both derive from
         * the same rpcData object, so a single identity-diffed slot handles
         * both uploads.
         */
        startRenderingBackend(backend: LDRenderingBackend) {
          self.attachRenderingBackend<LDRenderingBackend>(backend, {
            upload: b => {
              const d = self.rpcData
              if (!d) {
                return
              }
              b.uploadData({
                ldValues: d.ldValues,
                boundaries: d.boundaries,
                numCells: d.numCells,
                positions: d.positions,
                cellSizes: d.cellSizes,
              })
              b.uploadColorRamp(generateLDColorRamp(d.metric, d.signedLD))
            },
            render: b => {
              const state = self.renderState
              if (!state) {
                return false
              }
              const d = self.rpcData
              b.render(
                d
                  ? {
                      ldValues: d.ldValues,
                      boundaries: d.boundaries,
                      numCells: d.numCells,
                      positions: d.positions,
                      cellSizes: d.cellSizes,
                    }
                  : null,
                state,
              )
              return true
            },
          })
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        filterMenuItems() {
          // Filter settings only available for VCF-computed LD, not pre-computed
          if (self.isPrecomputedLD) {
            return []
          }
          return [
            {
              label: 'LD-specific filters...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  LDFilterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'General JEXL filters...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  AddFiltersDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
        /**
         * #method
         */
        legendItems(): LegendItem[] {
          const metric = self.effectiveLdMetric === 'dprime' ? "D'" : 'R²'
          const range = self.signedLD ? '-1 to 1' : '0 to 1'
          return [{ label: `${metric}: ${range}` }]
        },
        /**
         * #method
         */
        svgLegendWidth(): number {
          return self.showLegend ? 140 : 0
        },
      }))
      .views(self => {
        const { trackMenuItems: superTrackMenuItems } = self
        return {
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
                        {
                          label: 'Show signed LD values (-1 to 1)',
                          helpText:
                            "When enabled, shows R (correlation) instead of R², and preserves the sign of D'. Positive values indicate alleles tend to co-occur (coupling), negative values indicate alleles tend to be on different haplotypes (repulsion).",
                          type: 'checkbox',
                          checked: self.signedLD,
                          onClick: () => {
                            self.setSignedLD(!self.signedLD)
                          },
                        },
                      ]),
                ],
              },
              {
                label: 'Show...',
                icon: VisibilityIcon,
                type: 'subMenu',
                subMenu: [
                  {
                    label: 'Show LD triangle',
                    type: 'checkbox',
                    checked: self.showLDTriangle,
                    onClick: () => {
                      self.setShowLDTriangle(!self.showLDTriangle)
                    },
                  },
                  {
                    label: 'Show recombination track',
                    helpText:
                      'Displays 1-r² between neighboring SNPs only (not all pairwise comparisons). Peaks indicate haplotype block boundaries where historical recombination has broken down LD between adjacent variants.',
                    type: 'checkbox',
                    checked: self.showRecombination,
                    onClick: () => {
                      self.setShowRecombination(!self.showRecombination)
                    },
                  },
                  {
                    label: 'Show legend',
                    type: 'checkbox',
                    checked: self.showLegend,
                    onClick: () => {
                      self.setShowLegend(!self.showLegend)
                    },
                  },
                  {
                    label: 'Show variant labels',
                    type: 'checkbox',
                    checked: self.showLabels,
                    onClick: () => {
                      self.setShowLabels(!self.showLabels)
                    },
                  },
                  {
                    label: 'Show vertical guides on hover',
                    type: 'checkbox',
                    checked: self.showVerticalGuides,
                    onClick: () => {
                      self.setShowVerticalGuides(!self.showVerticalGuides)
                    },
                  },
                  // Layout toggles live alongside the visibility toggles in
                  // this submenu, matching the Hi-C triangular display's
                  // "Show..." grouping (plugins/hic trackMenuItems.ts) so the
                  // two contact-map displays stay consistent.
                  {
                    label: 'Fit to display height',
                    helpText:
                      'Vertically squash the triangle to fill the display height instead of drawing it at its natural half-width height.',
                    type: 'checkbox',
                    checked: self.fitToHeight,
                    onClick: () => {
                      self.setFitToHeight(!self.fitToHeight)
                    },
                  },
                  {
                    label: 'Show cells with genome proportions',
                    helpText:
                      'By default each cell is equal width (one column per variant). Enable to size cells proportional to the genomic distance between variants.',
                    type: 'checkbox',
                    checked: self.useGenomicPositions,
                    onClick: () => {
                      self.setUseGenomicPositions(!self.useGenomicPositions)
                    },
                  },
                ],
              },
              // Filter menu only available for VCF-computed LD, not pre-computed
              ...(self.isPrecomputedLD
                ? []
                : [
                    {
                      label: 'Filter by...',
                      icon: ClearAllIcon,
                      type: 'subMenu',
                      subMenu: self.filterMenuItems(),
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
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized) {
            return
          }
          const regions = view.dynamicBlocks.contentBlocks
          if (!self.showLDTriangle || self.regionTooLarge || !regions.length) {
            return
          }
          const { bpPerPx } = view
          const { adapterConfig } = self
          await self.runFetch(async ctx => {
            const { rpcManager } = getSession(self)
            const sessionId = getRpcSessionId(self)
            // The feature-density byte-gate estimates fetch size via
            // CoreGetRegionByteEstimate -> getFeatures, which only the
            // VCF-computed path's feature adapter implements. Pre-computed LD
            // adapters (PlinkLD*) aren't feature adapters and ship pre-thinned
            // files, so skip the density probe (it would throw "Adapter does not
            // support retrieving features") and render them directly.
            if (!self.isPrecomputedLD) {
              const stats = await rpcManager.call(
                sessionId,
                'CoreGetRegionByteEstimate',
                { regions: [...regions], adapterConfig },
              )
              if (ctx.isStale()) {
                return
              }
              // Commit the estimate; the derived regionTooLarge getter then
              // composes the shared verdict (AUTO_FORCE_LOAD_BP floor + bytes>limit
              // precedence) as a pure function of the estimate × current viewport,
              // so it self-releases on zoom-in without an imperative re-clear.
              self.setByteEstimate(stats)
              if (self.regionTooLarge) {
                return
              }
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
            self.setLastDrawnViewport(view.offsetPx, view.bpPerPx)
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
  )
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>
