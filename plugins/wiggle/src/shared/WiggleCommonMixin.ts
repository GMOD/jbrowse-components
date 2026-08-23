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
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import {
  RESOLUTION_MAX,
  RESOLUTION_MIN,
  WiggleScoreConfigMixin,
} from './WiggleScoreConfigMixin.ts'
import { wiggleFeatureWidgetData } from './wiggleHitTest.ts'

import type { WiggleHoveredFeature } from '../util.ts'
import type { summaryScoreModeConfigSchemaFields } from './summaryScoreModeConfigSchemaFields.ts'
import type { wiggleConfigSchemaFields } from './wiggleConfigSchemaFields.ts'
import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

/**
 * The one slot this mixin reads that no shared table can hold: each wiggle
 * display gives `defaultRendering` a different enum and default (`xyplot` vs
 * `multirowxy`), so only its TYPE is common, which is all the cast needs.
 * Naming it keeps the other slot names below checked; widening the cast to
 * cover it gives up all of them.
 *
 * A runtime value rather than a bare type so the restatement can be checked
 * against the real declarations — see `legendMixinSlots` for why, and
 * `RestatedMixinSlots.test.ts` for the comparison. `defaultValue` is a
 * placeholder; the test checks the key's presence and its `type`.
 */
export const wiggleCommonExtraSlots = {
  defaultRendering: { type: 'stringEnum', defaultValue: '' },
} as const

type WiggleCommonConfigModel = ConfigModelForFields<
  typeof wiggleConfigSchemaFields &
    ReturnType<typeof summaryScoreModeConfigSchemaFields> &
    typeof wiggleCommonExtraSlots
>

/** The whole of what `WiggleCommonMixin` needs a composing display to be. */
export type WiggleCommonHost = ResolvableDisplay<WiggleCommonConfigModel>

const confNode = (self: object) => self as WiggleCommonHost

// The visible per-source feature arrays that feed autoscale, clipped to the
// coarse (500ms debounced) blocks so the domain doesn't recompute on every
// animation frame during zoom. `undefined` until the view + data are ready.
// A free function rather than a getter to keep the mixin's `.views` layering
// shallow enough for MST's compose type inference.
//
// `settledDynamicBlocks`, not `coarseDynamicBlocks`: empty coarse blocks yield
// no entries, and no entries is not a stale domain but the fallback one. See
// that getter.
function visibleEntries(
  self: IStateTreeNode & {
    rpcDataMap: ReadonlyMap<number, WiggleDataResult>
    autoscaleSourceNames: Set<string> | undefined
  },
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  if (!view.initialized || self.rpcDataMap.size === 0) {
    return undefined
  }
  const names = self.autoscaleSourceNames
  return view.settledDynamicBlocks.flatMap(block => {
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
      rpcDataMap: regionDataMap<WiggleDataResult>('rpcDataMap'),
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
       * Strict zoom equality (adr-008): the worker bins scores to the requested
       * bpPerPx, so data fetched at another zoom is the wrong summary, however
       * well the viewport still sits inside it.
       *
       * On this mixin, not the score-config one below it: the rule is about
       * what a fetch returns, and `LinearManhattanDisplay` composes that mixin
       * for the score axis while fetching untransformed SNPs.
       */
      get regionFetchKey(): string {
        return String(
          (getContainingView(self) as LinearGenomeViewModel).bpPerPx,
        )
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
       * Scores the axis must reach whatever the data does, so a rule drawn at
       * one stays on it. `[]` here and overridden by the displays that draw
       * score rules — MultiLinearWiggleDisplay stacks a plot box per row and
       * draws none, so it keeps the base.
       */
      get scoreRuleValues(): number[] {
        return []
      },
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
          domain: widenRangeToRules(range, self.scoreRuleValues),
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
      },
      /**
       * #action
       * The store half of both displays' `fetchNeeded`. Everything either one
       * derives from a fetch — multi-wiggle's row list included — is a getter
       * over this map, so there is nothing else for a result to update.
       */
      setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
        self.rpcDataMap.set(displayedRegionIndex, data)
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
