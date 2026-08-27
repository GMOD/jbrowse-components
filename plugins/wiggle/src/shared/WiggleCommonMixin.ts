import { getConf, resolveConf, setConf } from '@jbrowse/core/configuration'
import { getEnv, openFeatureWidget } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import {
  autoscaleDomainFromStats,
  computeScoreStats,
  visibleStatsDomain,
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
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

/**
 * The slots this mixin reads that no shared table can hold. `defaultRendering`
 * is given a different enum and default by each wiggle display (`xyplot` vs
 * `multirowxy`), so only its TYPE is common, which is all the cast needs;
 * `minimalTicks` is declared per display because the shared field table is
 * spread by `LinearManhattanDisplay` too, which owns its own axis. Naming them
 * keeps the other slot names below checked; widening the cast to cover them
 * gives up all of them.
 *
 * A runtime value rather than a bare type so the restatement can be checked
 * against the real declarations — see `legendMixinSlots` for why, and
 * `RestatedMixinSlots.test.ts` for the comparison. `defaultValue` is a
 * placeholder; the test checks the key's presence and its `type`.
 */
export const wiggleCommonExtraSlots = {
  defaultRendering: { type: 'stringEnum', defaultValue: '' },
  minimalTicks: { type: 'boolean', defaultValue: false },
} as const

type WiggleCommonConfigModel = ConfigModelForFields<
  typeof wiggleConfigSchemaFields &
    ReturnType<typeof summaryScoreModeConfigSchemaFields> &
    typeof wiggleCommonExtraSlots
>

/** The whole of what `WiggleCommonMixin` needs a composing display to be. */
export type WiggleCommonHost = ResolvableDisplay<WiggleCommonConfigModel>

const confNode = (self: object) => self as WiggleCommonHost

const regionHost = (self: object) => (self as { host: RegionHost }).host
const ownAdapterConfig = (self: object) =>
  (self as { adapterConfig: { type: string } }).adapterConfig

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
        return String(regionHost(self).bpPerPx)
      },
      /**
       * #getter
       * Raw `symlogConstant` slot; `0` means "derive from the domain". Resolve
       * it with `resolveSymlogConstant` once the domain is known.
       *
       * Here rather than on `WiggleScoreConfigMixin` because the slot is in
       * `wiggleConfigSchemaFields`, which is this mixin's host table. It sat
       * one level up, whose OTHER composer is `LinearManhattanDisplay` --
       * linear-only by construction, so its schema declares no
       * `symlogConstant` and the getter answered `undefined` while typed
       * `number`. Inert, because nothing on that path reads it, and invisible:
       * `getConf` on an undeclared slot returns `undefined` and reports
       * nothing at any layer. That is the same reasoning the getter already
       * carried for moving off `ScoreScaleMixin` (the alignments coverage band
       * composes that against a schema that never declares it) -- it just
       * stopped one mixin too high.
       */
      get symlogConstant(): number {
        return getConf(confNode(self), 'symlogConstant')
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
      get minimalTicks(): boolean {
        return getConf(confNode(self), 'minimalTicks')
      },
      /**
       * #getter
       * Asked of the display's OWN adapter, which for the GC display is the
       * synthesized GCContentAdapter rather than the track's raw sequence
       * adapter — the two diverged when the adapter config moved onto the
       * shared model. It answers the same today, since only BigWigAdapter and
       * MultiWiggleAdapter declare the capability, and the display's adapter is
       * the honest subject: the resolution slot it gates is passed to whatever
       * this display fetches from.
       */
      get hasResolution() {
        return getEnv(self)
          .pluginManager.getAdapterType(ownAdapterConfig(self).type)
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
    .views(() => ({
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
    }))
    .views(self => ({
      /**
       * #getter
       * The autoscaled domain over the sources visible in the settled blocks.
       * `undefined` until the view and the data are ready, which is not the
       * `[0, 1]` a caller falls back to — see `visibleStatsDomain`.
       */
      get domain() {
        const names = self.autoscaleSourceNames
        return visibleStatsDomain({
          active: true,
          view: regionHost(self),
          payloadFor: index => self.rpcDataMap.get(index),
          itemsFor: regionData =>
            regionData.sources.filter(
              source => names === undefined || names.has(source.name),
            ),
          accumulate: entries =>
            computeScoreStats(self.effectiveSummaryScoreMode, entries),
          range: (stats, entries) =>
            widenRangeToRules(
              autoscaleDomainFromStats({
                stats,
                autoscaleType: self.autoscaleType,
                summaryScoreMode: self.effectiveSummaryScoreMode,
                numStdDev: self.numStdDev,
                numQuantile: self.numQuantile,
                visibleEntries: entries,
              }),
              self.scoreRuleValues,
            ),
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
