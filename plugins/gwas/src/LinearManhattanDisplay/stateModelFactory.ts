import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchEachRegion,
} from '@jbrowse/plugin-linear-genome-view'
import { WiggleScoreConfigMixin } from '@jbrowse/plugin-wiggle'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeYTicks,
  getNiceDomain,
  makeCrossHatchItem,
  makeScatterPointSizeMenuItem,
  makeScoreSubMenu,
  resolveRenderState,
} from '@jbrowse/wiggle-core'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { autorun, observable } from 'mobx'

import TooltipComponent from './components/TooltipComponent.tsx'
import { isIndexSnpOffscreen } from './isIndexSnpOffscreen.ts'
import { DEFAULT_POINT_DIAMETER_PX } from './manhattanRenderingBackendTypes.ts'

import type { ManhattanHit } from './findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
} from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const LinearManhattanDisplayComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent.tsx'),
)

/**
 * #stateModel LinearManhattanDisplay
 * GWAS Manhattan-plot display drawing -log10 p-values as a scored scatter along
 * the genome, with a feature widget on click.
 */
export function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearManhattanDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleScoreConfigMixin(),
      types.model({
        type: types.literal('LinearManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based)
         * string. Auto-tracks the highest-scoring loaded SNP unless the user
         * pins one (see `indexSnpPinned`).
         */
        indexSnp: types.maybe(types.string),
        /**
         * #property
         * True once the user pins a specific index SNP (right-clicking a point).
         * While false, the index auto-tracks the top hit as data loads.
         */
        indexSnpPinned: types.stripDefault(types.boolean, false),
      }),
    )
    .volatile(() => ({
      // 1:1 points keyed by displayedRegionIndex.
      rpcDataMap: observable.map<number, ManhattanRpcResult>(),
      // Wrapped Flatbush per region. Kept in lockstep with rpcDataMap so
      // a single-region fetch only re-wraps that region (whole-genome views
      // land 20+ regions serially; a derived view would re-wrap them all).
      flatbushes: observable.map<number, Flatbush>(),
      // Currently hovered point — drives the hover circle + tooltip.
      featureUnderMouse: undefined as ManhattanHit | undefined,
      showLdLegend: true,
    }))
    .views(self => ({
      /**
       * #getter
       * the containing LGV, typed once here so downstream getters don't repeat
       * the `getContainingView` cast
       */
      get view(): LinearGenomeViewModel {
        return getContainingView(self) as LinearGenomeViewModel
      },
      /**
       * #getter
       */
      get DisplayMessageComponent() {
        return LinearManhattanDisplayComponent
      },
      /**
       * #getter
       * Offset the track label above the plot so the -log10(p) y-axis stays
       * pinned to the content edge instead of dodging right of the label.
       */
      get prefersOffset() {
        return true
      },
      /**
       * #getter
       */
      get TooltipComponent() {
        return TooltipComponent
      },
      /**
       * #getter
       * resolved point color
       */
      get color(): string {
        return getConf(self, 'color')
      },
      /**
       * #getter
       * resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to the
       * index SNP
       */
      get colorBy(): 'normal' | 'ld' {
        return getConf(self, 'colorBy')
      },
      /**
       * #getter
       * the configured PLINK .ld adapter, or undefined when none is set (the
       * slot defaults to null, normalized here to undefined for "absent")
       */
      get ldAdapterConfig(): Record<string, unknown> | undefined {
        return readConfObject(self.configuration, 'ldAdapter') ?? undefined
      },
      /**
       * #getter
       * LD coloring needs a configured .ld adapter; without one the
       * colorBy='ld' controls are inert, so they're hidden/disabled
       */
      get hasLdData(): boolean {
        return this.ldAdapterConfig !== undefined
      },
      /**
       * #getter
       * nice-rounded [min, max] -log10 p domain across loaded regions, or
       * undefined before any data loads
       */
      get domain(): [number, number] | undefined {
        let scoreMin = Infinity
        let scoreMax = -Infinity
        for (const d of self.rpcDataMap.values()) {
          if (d.numFeatures === 0) {
            continue
          }
          if (d.scoreMin < scoreMin) {
            scoreMin = d.scoreMin
          }
          if (d.scoreMax > scoreMax) {
            scoreMax = d.scoreMax
          }
        }
        if (!Number.isFinite(scoreMin)) {
          return undefined
        }
        return getNiceDomain({
          domain: [scoreMin, scoreMax],
          bounds: [self.minScoreBound, self.maxScoreBound],
          scaleType: 'linear',
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * y-axis tick positions. Manhattan plots are linear-only (pre-transformed
       * -log10 p values); the inherited scaleType config is intentionally
       * ignored so the axis ticks stay consistent with the linear `domain`.
       */
      get ticks() {
        return computeYTicks({
          height: self.height,
          domain: self.domain,
          scaleType: 'linear',
          minimalTicks: getConf(self, 'minimalTicks'),
        })
      },
      /**
       * #method
       * fetch inputs watched by SettingsInvalidate — any change (color, colorBy,
       * index SNP, LD adapter) triggers a refetch, since the worker bakes
       * per-feature color into the result
       */
      rpcProps(): {
        color: string
        colorBy: 'normal' | 'ld'
        indexSnp: string | undefined
        ldAdapterConfig: Record<string, unknown> | undefined
      } {
        return {
          color: self.color,
          colorBy: self.colorBy,
          indexSnp: self.indexSnp,
          ldAdapterConfig: self.ldAdapterConfig,
        }
      },
      /**
       * #getter
       * render geometry for the inner canvas (between top/bottom YScaleBar label
       * offsets) — the area both the GPU renderer and findManhattanHit work in.
       * Using self.height directly would drift the hit-test off the rendered
       * points.
       */
      get renderState(): ManhattanRenderState {
        const view = self.view
        const canvasWidth = view.trackWidthPx
        const canvasHeight = self.height - 2 * YSCALEBAR_LABEL_OFFSET
        return resolveRenderState(self.domain, domainY => ({
          domainY,
          canvasWidth,
          canvasHeight,
          pointDiameterPx: self.scatterPointSize,
        }))
      },
      /**
       * #getter
       * displayedRegionIndex → refName lookup. Hit-testing reads this on every
       * mousemove; MobX caches the view so visibleRegions changes invalidate it
       * once rather than rebuilding per event.
       */
      get regionRefNames(): ReadonlyMap<number, string> {
        const view = self.view
        return new Map(
          view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default
       * LD index SNP. Derived from loaded data (not a fetch input), so it's
       * applied via the auto-pick autorun rather than read into rpcProps.
       */
      get topSnp(): string | undefined {
        let bestScore = -Infinity
        let bestPos = 0
        let bestIdx = -1
        for (const [idx, d] of self.rpcDataMap) {
          for (let i = 0; i < d.numFeatures; i++) {
            const s = d.scores[i]!
            if (s > bestScore) {
              bestScore = s
              bestPos = d.positions[i]!
              bestIdx = idx
            }
          }
        }
        // refName from displayedRegions (not visible-only regionRefNames):
        // rpcDataMap keeps buffered regions that may have scrolled off-screen,
        // and the top hit can live in one of them — resolving via visible
        // regions alone would drop it and stall the LD auto-index autorun.
        const view = self.view
        const refName =
          bestIdx === -1 ? undefined : view.displayedRegions[bestIdx]?.refName
        return refName ? `${refName}:${bestPos + 1}` : undefined
      },
      /**
       * #getter
       * true when LD coloring is active with data loaded, but no region's LD
       * data referenced the index SNP — so every point is grey. LD is a
       * single-region analysis, so "found in no loaded region" means missing.
       */
      get indexSnpMissing(): boolean {
        const ldActive = self.colorBy === 'ld' && self.indexSnp !== undefined
        return (
          ldActive &&
          self.rpcDataMap.size > 0 &&
          !Array.from(self.rpcDataMap.values()).some(d => d.indexFound)
        )
      },
      /**
       * #getter
       * When the index SNP is a `chr:bp` locus, whether it lies outside every
       * visible region — the benign, pannable cause of `indexSnpMissing`
       * (PLINK `--ld-window` files carry no records once you pan away from the
       * index), as opposed to reference-name aliasing or the SNP being absent
       * from the file. A bare rsID index returns false since its position isn't
       * known here.
       */
      get indexSnpOffscreen(): boolean {
        return isIndexSnpOffscreen(self.indexSnp, self.view.visibleRegions)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * open the feature details widget for a clicked point
       */
      selectFeature(hit: ManhattanHit) {
        openFeatureWidget(self, {
          uniqueId: `manhattan-${hit.refName}-${hit.start}`,
          refName: hit.refName,
          start: hit.start,
          end: hit.end,
          score: hit.score,
          r2: hit.r2,
        })
      },
      /**
       * #action
       */
      setRpcData(idx: number, data: ManhattanRpcResult) {
        self.rpcDataMap.set(idx, data)
        if (data.flatbushData) {
          self.flatbushes.set(idx, Flatbush.from(data.flatbushData))
        } else {
          self.flatbushes.delete(idx)
        }
      },
      /**
       * #action
       */
      setFeatureUnderMouse(hit: ManhattanHit | undefined) {
        self.featureUnderMouse = hit
      },
      /**
       * #action
       */
      setShowLdLegend(val: boolean) {
        self.showLdLegend = val
      },
      /**
       * #action
       */
      setColorBy(mode: 'normal' | 'ld') {
        self.configuration.setSlot('colorBy', mode)
      },
      /**
       * #action
       */
      setIndexSnp(snp?: string) {
        self.indexSnp = snp
      },
      /**
       * #action
       * right-click "Color by LD to this SNP": switch into LD mode and pin the
       * index on the clicked point, so the auto-pick stops tracking the top hit.
       * Keyed by chr:bp (1-based) to match the worker's posKey. All mutations
       * happen in one action so rpcProps settles once and only a single recolor
       * fetch fires.
       */
      colorByLdToHit(hit: ManhattanHit) {
        self.configuration.setSlot('colorBy', 'ld')
        self.indexSnp = `${hit.refName}:${hit.start + 1}`
        self.indexSnpPinned = true
      },
      /**
       * #action
       * release a pinned index back to auto-tracking, seeded at the current top
       * hit (the auto-pick autorun then keeps it on the top hit as data loads)
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST action named for its semantic meaning, not a React hook
      useTopHitAsIndex() {
        self.indexSnpPinned = false
        self.indexSnp = self.topSnp
      },
      /**
       * #action
       */
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.flatbushes.clear()
      },
    }))
    .views(self => ({
      /**
       * #method
       * Manhattan track menu: shared Score submenu plus LD-coloring controls.
       * Rendering type / Resolution / Scale type don't apply to single-point
       * rendering of pre-transformed -log10 p values. Placed after the
       * color/index actions so referencing them doesn't make MST inference
       * circular.
       */
      trackMenuItems() {
        return [
          makeScoreSubMenu(self, { scaleType: false }),
          makeScatterPointSizeMenuItem(self, {
            label: 'Point size',
            defaultValue: DEFAULT_POINT_DIAMETER_PX,
          }),
          makeCrossHatchItem(self),
          {
            // whole submenu greys out without a configured .ld adapter
            label: 'LD options',
            disabled: !self.hasLdData,
            disabledHelpText: 'Requires a configured LD (PLINK .ld) adapter',
            subMenu: [
              {
                label: 'Color by LD to index SNP',
                type: 'checkbox' as const,
                checked: self.colorBy === 'ld',
                onClick: () => {
                  self.setColorBy(self.colorBy === 'ld' ? 'normal' : 'ld')
                },
              },
              {
                label: 'Show LD legend',
                type: 'checkbox' as const,
                checked: self.showLdLegend,
                disabled: self.colorBy !== 'ld',
                onClick: () => {
                  self.setShowLdLegend(!self.showLdLegend)
                },
              },
              {
                label: 'Set index SNP to top hit',
                disabled:
                  self.colorBy !== 'ld' || !self.topSnp || !self.indexSnpPinned,
                onClick: () => {
                  self.useTopHitAsIndex()
                },
              },
            ],
          },
        ]
      },
      /**
       * #method
       * right-click menu for a clicked point: feature details plus, when an LD
       * adapter is configured, a shortcut to recolor by LD to that SNP
       */
      contextMenuItems(hit: ManhattanHit): MenuItem[] {
        return [
          {
            label: 'Open feature details',
            icon: MenuOpenIcon,
            onClick: () => {
              self.selectFeature(hit)
            },
          },
          ...(self.hasLdData
            ? [
                {
                  label: `Color by LD to ${hit.refName}:${hit.start + 1}`,
                  onClick: () => {
                    self.colorByLdToHit(hit)
                  },
                },
              ]
            : []),
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Manhattan features are 1:1 with the underlying SNPs (pre-transformed
       * -log10 p values) and don't downsample by zoom, so we never need to
       * refetch on bpPerPx change. We intentionally don't call setLoadedBpPerPx
       * — the inherited isCacheValid short-circuits to true whenever
       * loadedBpPerPx is undefined, which is exactly the behavior we want here.
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const { adapterConfig } = self
        if (adapterConfig) {
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          return fetchEachRegion(self, needed, {
            call: (region, ctx, displayedRegionIndex) =>
              rpcManager.call(sessionId, 'GetManhattanData', {
                adapterConfig,
                region,
                ...self.rpcProps(),
                stopToken: ctx.stopToken,
                statusCallback:
                  self.makeRegionStatusCallback(displayedRegionIndex),
              }),
            onResult: (idx, result) => {
              self.setRpcData(idx, result)
            },
          })
        }
        return undefined
      },
      /**
       * #action
       */
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
      /**
       * #action
       * identity encode — RPC result is the upload payload
       */
      startRenderingBackend(backend: ManhattanRenderingBackend) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          b => {
            // size === 0 gates first paint until data lands (keep the loading
            // overlay up); once loaded, renderState is always a real-or-stub
            // state, so an empty region paints a cleared canvas.
            if (self.rpcDataMap.size === 0) {
              return false
            }
            b.renderBlocks(self.renderBlocks, self.rpcDataMap, self.renderState)
            return true
          },
        )
      },
    }))
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
        afterAttach() {
          superAfterAttach()
          // LocusZoom-style default: while no index SNP is pinned, keep the
          // index anchored on the highest-scoring loaded SNP, re-tracking it as
          // higher-scoring data streams in. Setting indexSnp triggers one
          // recoloring fetch; topSnp is a fixpoint under recoloring (it depends
          // only on positions/scores, which recoloring leaves unchanged), so
          // this converges rather than looping.
          addDisposer(
            self,
            autorun(() => {
              if (
                self.colorBy === 'ld' &&
                !self.indexSnpPinned &&
                self.topSnp &&
                self.topSnp !== self.indexSnp
              ) {
                self.setIndexSnp(self.topSnp)
              }
            }),
          )
        },
      }
    })
}

export type LinearManhattanDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearManhattanDisplayModel =
  Instance<LinearManhattanDisplayStateModel>
