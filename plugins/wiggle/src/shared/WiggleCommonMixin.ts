import { getConf, resolveConf, setConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { installClearHoverOnViewportChange } from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import {
  autoscaleDomainFromStats,
  computeScoreStats,
  getNiceDomain,
} from '../util.ts'
import {
  RESOLUTION_MAX,
  RESOLUTION_MIN,
  WiggleScoreConfigMixin,
  confNode,
} from './WiggleScoreConfigMixin.ts'
import { wiggleFeatureWidgetData } from './wiggleComponentUtils.ts'

import type { WiggleDataResult, WiggleFeatureUnderMouse } from '../util.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ObservableMap } from 'mobx'

// The visible per-source feature arrays that feed autoscale, clipped to the
// coarse (500ms debounced) blocks so the domain doesn't recompute on every
// animation frame during zoom. `undefined` until the view + data are ready.
// A free function rather than a getter to keep the mixin's `.views` layering
// shallow enough for MST's compose type inference.
function visibleEntries(
  self: IStateTreeNode & {
    rpcDataMap: ObservableMap<number, WiggleDataResult>
    autoscaleSourceNames: Set<string> | undefined
  },
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  if (!view.initialized || self.rpcDataMap.size === 0) {
    return undefined
  }
  const names = self.autoscaleSourceNames
  return view.coarseDynamicBlocks.flatMap(block => {
    const regionData = self.rpcDataMap.get(block.displayedRegionIndex!)
    if (!regionData) {
      return []
    }
    const visStart = Math.floor(block.start)
    const visEnd = Math.ceil(block.end)
    return regionData.sources
      .filter(source => !names || names.has(source.name))
      .map(source => ({ visStart, visEnd, data: source }))
  })
}

/**
 * #stateModel WiggleCommonMixin
 * #category display
 *
 * Extends WiggleScoreConfigMixin with rpcDataMap, autoscale domain, and cache
 * reset — plus the wiggle-specific config that used to sit in that mixin (the
 * pos/neg palette, rendering type, summary mode, resolution and the line/gap
 * settings). They live here because this is where they are *read*: the other
 * composer of WiggleScoreConfigMixin, LinearManhattanDisplay, touches none of
 * them and was inheriting a config schema advertising them anyway. Moved onto
 * this chain with `.props()`/`.views()` rather than a new mixin composed in, so
 * no `types.compose` layer is added (ADR-041).
 *
 * Used by LinearWiggleDisplay and MultiLinearWiggleDisplay. Displays that own a
 * different rpcDataMap type should compose WiggleScoreConfigMixin directly.
 */
export function WiggleCommonMixin() {
  return WiggleScoreConfigMixin()
    .props({
      /**
       * #property
       */
      resolution: types.stripDefault(types.number, 1),
    })
    .volatile(() => ({
      /**
       * #volatile
       * Shallow: a region's payload is replaced via `.set`/`.clear`, never
       * mutated in place, and installPerRegionLifecycle's per-key autorun
       * tracks the map entry rather than anything inside it — so the deep
       * enhancer's recursive wrap buys nothing and costs a full
       * observable-object conversion per source per region on every fetch (a
       * thousand-sample density track pays ~18 atoms × 1000 × regions per pan),
       * plus a `getObservablePropValue_` on each field read in the encode and
       * hit-test paths. Same call and same reasoning as
       * LinearAlignmentsDisplay's rpcDataMap.
       */
      rpcDataMap: observable.map<number, WiggleDataResult>(undefined, {
        deep: false,
      }),
      /**
       * #volatile
       */
      featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get posColor(): string {
        return getConf(confNode(self), 'posColor')
      },
      /**
       * #getter
       */
      get negColor(): string {
        return getConf(confNode(self), 'negColor')
      },
      /**
       * #getter
       */
      get bicolorPivot(): number {
        return getConf(confNode(self), 'bicolorPivot')
      },
      /**
       * #getter
       */
      get numQuantile(): number {
        return getConf(confNode(self), 'numQuantile')
      },
      /**
       * #getter
       */
      get lineWidth(): number {
        return resolveConf(confNode(self), 'lineWidth')
      },
      /**
       * #getter
       * Interpolated-line gap threshold, as a multiple of the track's own mean
       * point spacing (see gapBreakLimit). 0 keeps one connected line.
       */
      get maxGapMultiple(): number {
        return getConf(confNode(self), 'maxGapMultiple')
      },
      /**
       * #getter
       */
      get summaryScoreMode(): string {
        return getConf(confNode(self), 'summaryScoreMode')
      },
      /**
       * #getter
       */
      get renderingType(): string {
        return getConf(confNode(self), 'defaultRendering')
      },
      /**
       * #getter
       */
      get hasResolution() {
        const { pluginManager } = getEnv(self)
        const adapterConfig = getConf(getContainingTrack(self), 'adapter') as {
          type: string
        }
        return pluginManager
          .getAdapterType(adapterConfig.type)
          .adapterCapabilities.includes('hasResolution')
      },
      /**
       * #getter
       * The summary mode actually drawn. Density has no whiskers presentation
       * — `sourceLayers` falls back to the average scores — so the autoscale
       * domain reads this rather than the raw slot; otherwise the color ramp
       * spans the whisker extremes while the plot paints averages, and the
       * score legend reports a range nothing on screen reaches. Single-wiggle
       * defaults to whiskers, so plain "plot type → Density" hit this.
       */
      get effectiveSummaryScoreMode() {
        return self.isDensityMode && this.summaryScoreMode === 'whiskers'
          ? 'avg'
          : this.summaryScoreMode
      },
    }))
    .views(() => ({
      /**
       * #getter
       * Source names to include when computing the autoscale domain;
       * `undefined` means every fetched source. Multi-wiggle always fetches all
       * sources and filters client-side, so it overrides this to the visible
       * subset — otherwise a subtree filter that hides sources would leave the
       * Y-axis scaled to the hidden ones.
       */
      get autoscaleSourceNames(): Set<string> | undefined {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The visible feature arrays plus their min/max/mean/stddev, walked once
       * per domain recompute rather than once per autoscale input.
       */
      get visibleScoreStats() {
        const entries = visibleEntries(self)
        return entries
          ? {
              entries,
              stats: computeScoreStats(self.effectiveSummaryScoreMode, entries),
            }
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleScoreRange() {
        const visible = self.visibleScoreStats
        return visible?.stats
          ? autoscaleDomainFromStats({
              stats: visible.stats,
              autoscaleType: self.autoscaleType,
              summaryScoreMode: self.effectiveSummaryScoreMode,
              numStdDev: self.numStdDev,
              numQuantile: self.numQuantile,
              visibleEntries: visible.entries,
            })
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get domain() {
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreBound, self.maxScoreBound],
          scaleType: self.scaleType,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.setLoadedBpPerPx(undefined)
      },
      /**
       * #action
       */
      setFeatureUnderMouse(feat?: WiggleFeatureUnderMouse) {
        self.featureUnderMouse = feat
      },
      /**
       * #action
       */
      selectFeature(feat: WiggleFeatureUnderMouse) {
        openFeatureWidget(self, wiggleFeatureWidgetData(feat))
      },
      /**
       * #action
       */
      setResolution(res: number) {
        self.resolution = Math.min(
          RESOLUTION_MAX,
          Math.max(RESOLUTION_MIN, res),
        )
      },
      /**
       * #action
       */
      setBicolorPivot(val?: number) {
        setConf(confNode(self), 'bicolorPivot', val)
      },
      /**
       * #action
       * Lives here beside the `posColor`/`negColor` getters and
       * `setBicolorPivot` so both the single- and multi-wiggle color editors
       * write the score-sign palette the same way.
       */
      setPosColor(color?: string) {
        setConf(confNode(self), 'posColor', color)
      },
      /**
       * #action
       */
      setNegColor(color?: string) {
        setConf(confNode(self), 'negColor', color)
      },
      /**
       * #action
       */
      setRenderingType(type: string) {
        setConf(confNode(self), 'defaultRendering', type)
      },
      /**
       * #action
       */
      setSummaryScoreMode(val: string) {
        setConf(confNode(self), 'summaryScoreMode', val)
      },
      /**
       * #action
       */
      setLineWidth(val?: number) {
        setConf(confNode(self), 'lineWidth', val)
      },
    }))
    .actions(self => ({
      // No superAfterAttach() call: the fork auto-chains lifecycle hooks, so a
      // composing display's own afterAttach still runs.
      afterAttach() {
        // The plot is a painted canvas with no element travelling with its
        // features, so a pan/zoom/scroll under a stationary cursor fires no
        // mousemove and no mouseleave: the tooltip stays open reporting the bp
        // and score the cursor was over *before* the content moved. Clearing on
        // all three axes is what installClearHoverOnViewportChange is for —
        // don't reduce it to bpPerPx, a locstring pan moves offsetPx alone.
        //
        // `scrollTop` belongs to TrackHeightMixin, which both composers bring
        // but this mixin can't see — the same reason WiggleScoreConfigMixin
        // casts for its config reads.
        addDisposer(
          self,
          installClearHoverOnViewportChange(
            self as typeof self & { scrollTop: number },
            () => {
              self.setFeatureUnderMouse(undefined)
            },
          ),
        )
      },
    }))
}
