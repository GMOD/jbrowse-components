import { getConf, resolveConf, setConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { regionDataMap } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  autoscaleDomainFromStats,
  computeScoreStats,
  getNiceDomain,
} from '@jbrowse/wiggle-core'

import {
  RESOLUTION_MAX,
  RESOLUTION_MIN,
  WiggleScoreConfigMixin,
} from './WiggleScoreConfigMixin.ts'
import { wiggleFeatureWidgetData } from './wiggleHitTest.ts'

import type { WiggleHoveredFeature } from '../util.ts'
import type { wiggleConfigSchemaFields } from './wiggleConfigSchemaFields.ts'
import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'
import type { ObservableMap } from 'mobx'

// This mixin reads two slots past the shared table, and they are restated here
// rather than moved into it because the two wiggle displays genuinely disagree
// about them: `defaultRendering` takes a different enum and default in each
// (`xyplot` vs `multirowxy`), and `summaryScoreMode` a different default
// (`whiskers` vs `avg`). Naming them costs a line each and keeps the other six
// slot names below checked; widening the cast to cover them would give up all
// eight. gccontent hand-declares `summaryScoreMode` a third time, so a
// parameterized field table is the eventual fix.
type WiggleCommonConfigModel = ConfigModelForFields<
  typeof wiggleConfigSchemaFields & {
    summaryScoreMode: { type: 'stringEnum'; defaultValue: string }
    defaultRendering: { type: 'stringEnum'; defaultValue: string }
  }
>

const confNode = (self: object) =>
  self as ResolvableDisplay<WiggleCommonConfigModel>

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
       */
      rpcDataMap: regionDataMap<WiggleDataResult>(),
      /**
       * #volatile
       * The stored hit. Named apart from the `hoveredFeature` getter below it
       * fills, because `BaseDisplay` declares that hook as a computed and MST
       * refuses to instantiate a volatile over one — a display filling it stores
       * under its own name and exposes a getter, which is what canvas,
       * alignments and the variant displays already did.
       */
      hoveredWiggleFeature: undefined as WiggleHoveredFeature | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * Fills `BaseDisplay`'s cross-display hover hook.
       */
      get hoveredFeature() {
        return self.hoveredWiggleFeature
      },
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
      setHoveredFeature(feat?: WiggleHoveredFeature) {
        self.hoveredWiggleFeature = feat
      },
      /**
       * #action
       */
      selectFeature(feat: WiggleHoveredFeature) {
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
      // The plot is a painted canvas with no element travelling with its
      // features, so a pan/zoom/scroll under a stationary cursor fires no
      // mousemove and no mouseleave: the tooltip would stay open reporting the
      // bp and score the cursor was over *before* the content moved.
      // `MultiRegionDisplayMixin` installs the reaction that catches all four
      // axes; this is the half it calls.
      clearHoveredFeature() {
        self.setHoveredFeature(undefined)
      },
    }))
}
