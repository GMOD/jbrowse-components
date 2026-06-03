import { lazy } from 'react'

import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { installPerRegionLifecycle } from '@jbrowse/core/gpu/installPerRegionLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { WiggleScoreConfigMixin } from '@jbrowse/plugin-wiggle'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeYTicks,
  getNiceDomain,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
} from '@jbrowse/wiggle-core'
import { autorun, observable } from 'mobx'

import TooltipComponent from './components/TooltipComponent.tsx'
import {
  GENOME_WIDE_COLOR,
  SUGGESTIVE_COLOR,
  buildSignificanceLines,
} from './significanceLines.ts'

import type { ManhattanHit } from './findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
} from './manhattanRenderingBackendTypes.ts'
import type { SignificanceLine } from './significanceLines.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const LinearManhattanDisplayComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent.tsx'),
)

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
         * string. When unset in LD mode it auto-picks the highest-scoring SNP.
         */
        indexSnp: types.maybe(types.string),
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
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return LinearManhattanDisplayComponent
      },
      get TooltipComponent() {
        return TooltipComponent
      },
      get color() {
        return self.getConfWithOverride<string>('color')
      },
      get colorBy() {
        return self.getConfWithOverride<'normal' | 'ld'>('colorBy')
      },
      get ldAdapterConfig(): Record<string, unknown> | undefined {
        // unset slot defaults to null; normalize to undefined for "absent"
        return readConfObject(self.configuration, 'ldAdapter') ?? undefined
      },
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
          bounds: [self.minScoreConfig, self.maxScoreConfig],
          scaleType: 'linear',
        })
      },
    }))
    .views(self => ({
      // Manhattan plots are linear-only (pre-transformed -log10 p values);
      // the inherited scaleType config is intentionally ignored here so the
      // axis ticks stay consistent with the linear `domain` above.
      get ticks() {
        return computeYTicks({
          height: self.height,
          domain: self.domain,
          scaleType: 'linear',
          minimalTicks: self.getConfWithOverride<boolean>('minimalTicks'),
        })
      },
      // Genome-wide / suggestive cutoff lines, mapped to overlay Y positions
      // against the current domain. Empty when toggled off or no data loaded.
      get significanceLines(): SignificanceLine[] {
        const { domain } = self
        const show = self.getConfWithOverride<boolean>('showSignificanceLines')
        return domain && show
          ? buildSignificanceLines({
              thresholds: [
                {
                  value: self.getConfWithOverride<number>(
                    'genomeWideSignificance',
                  ),
                  color: GENOME_WIDE_COLOR,
                  label: 'Genome-wide',
                },
                {
                  value: self.getConfWithOverride<number>(
                    'suggestiveSignificance',
                  ),
                  color: SUGGESTIVE_COLOR,
                  label: 'Suggestive',
                },
              ],
              domain,
              height: self.height,
              offset: YSCALEBAR_LABEL_OFFSET,
            })
          : []
      },
      // SettingsInvalidate watches this shape — any change (color, colorBy,
      // index SNP, LD adapter) triggers a refetch, since the worker bakes
      // per-feature color into the result.
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
      // canvasHeight is the inner canvas (between top/bottom YScaleBar
      // label offsets) — this is the area both the GPU renderer and
      // findManhattanHit work in. Using self.height directly would drift
      // the hit-test off the rendered points.
      get renderState(): ManhattanRenderState | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        const canvasWidth = view.trackWidthPx
        const canvasHeight = self.height - 2 * YSCALEBAR_LABEL_OFFSET
        return resolveRenderState(
          self.domain,
          self.rpcDataMap.size > 0,
          domainY => ({ domainY, canvasWidth, canvasHeight }),
        )
      },
      // displayedRegionIndex → refName lookup. Hit-testing reads this on
      // every mousemove; MobX caches the view so visibleRegions changes
      // invalidate it once rather than rebuilding per event.
      get regionRefNames(): ReadonlyMap<number, string> {
        const view = getContainingView(self) as LinearGenomeViewModel
        return new Map(
          view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
        )
      },
    }))
    .views(self => ({
      // Highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default
      // LD index SNP. Derived from loaded data (not a fetch input), so it's
      // applied via the auto-pick autorun rather than read into rpcProps.
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
        const refName =
          bestIdx === -1 ? undefined : self.regionRefNames.get(bestIdx)
        return refName ? `${refName}:${bestPos + 1}` : undefined
      },
      // True when LD coloring is active with data loaded, but no region's LD
      // data referenced the index SNP — so every point is grey. LD is a
      // single-region analysis, so "found in no loaded region" means missing.
      get indexSnpMissing(): boolean {
        const ldActive = self.colorBy === 'ld' && self.indexSnp !== undefined
        const loaded = [...self.rpcDataMap.values()]
        return ldActive && loaded.length > 0 && loaded.every(d => !d.indexFound)
      },
    }))
    .actions(self => ({
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
      setRpcData(idx: number, data: ManhattanRpcResult) {
        self.rpcDataMap.set(idx, data)
        if (data.flatbushData) {
          self.flatbushes.set(idx, Flatbush.from(data.flatbushData))
        } else {
          self.flatbushes.delete(idx)
        }
      },
      setFeatureUnderMouse(hit: ManhattanHit | undefined) {
        self.featureUnderMouse = hit
      },
      setColorBy(mode: 'normal' | 'ld') {
        self.setOverride('colorBy', mode)
      },
      setIndexSnp(snp?: string) {
        self.indexSnp = snp
      },
      // Right-click "Color by LD to this SNP": switch into LD mode and anchor
      // the index on the clicked point. Keyed by chr:bp (1-based) to match the
      // worker's posKey. Both mutations happen in one action so rpcProps
      // settles once and only a single recolor fetch fires.
      colorByLdToHit(hit: ManhattanHit) {
        self.setOverride('colorBy', 'ld')
        self.indexSnp = `${hit.refName}:${hit.start + 1}`
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.flatbushes.clear()
      },
    }))
    .views(self => ({
      // Manhattan menu: shared Score submenu plus LD-coloring controls.
      // Rendering type / Resolution / Scale type don't apply to single-point
      // rendering of pre-transformed -log10 p values. Placed after the
      // color/index actions so referencing them doesn't make MST inference
      // circular.
      trackMenuItems() {
        return [
          makeScoreSubMenu(self, { scaleType: false }),
          makeCrossHatchItem(self),
          {
            label: 'Color by LD to index SNP',
            type: 'checkbox' as const,
            checked: self.colorBy === 'ld',
            onClick: () => {
              self.setColorBy(self.colorBy === 'ld' ? 'normal' : 'ld')
            },
          },
          {
            label: 'Set index SNP to top hit',
            disabled: self.colorBy !== 'ld' || !self.topSnp,
            onClick: () => {
              self.setIndexSnp(self.topSnp)
            },
          },
          {
            label: 'Show significance lines',
            type: 'checkbox' as const,
            checked: self.getConfWithOverride<boolean>('showSignificanceLines'),
            onClick: () => {
              self.setOverride(
                'showSignificanceLines',
                !self.getConfWithOverride<boolean>('showSignificanceLines'),
              )
            },
          },
        ]
      },
    }))
    .actions(self => ({
      // Manhattan features are 1:1 with the underlying SNPs (pre-transformed
      // -log10 p values) and don't downsample by zoom, so we never need to
      // refetch on bpPerPx change. We intentionally don't call
      // setLoadedBpPerPx — the inherited isCacheValid short-circuits to true
      // whenever loadedBpPerPx is undefined, which is exactly the behavior
      // we want here.
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const { adapterConfig } = self
        if (!adapterConfig) {
          return
        }
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        await self.fetchRegions(needed, async (ctx: FetchContext) => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'GetManhattanData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  ...self.rpcProps(),
                  stopToken: ctx.stopToken,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                self.setRpcData(r.displayedRegionIndex, result)
              }
            }),
          )
        })
      },
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
      // Identity encode — RPC result is the upload payload.
      startRenderingBackend(backend: ManhattanRenderingBackend) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          b => {
            const state = self.renderState
            if (state) {
              b.renderBlocks(self.renderBlocks, self.rpcDataMap, state)
              return true
            }
            return false
          },
        )
      },
    }))
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
        afterAttach() {
          superAfterAttach()
          // LocusZoom-style default: in LD mode with no explicit index SNP,
          // adopt the highest-scoring loaded SNP. Setting indexSnp triggers a
          // single recoloring fetch; topSnp is then stable so it converges.
          addDisposer(
            self,
            autorun(() => {
              if (self.colorBy === 'ld' && !self.indexSnp && self.topSnp) {
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
