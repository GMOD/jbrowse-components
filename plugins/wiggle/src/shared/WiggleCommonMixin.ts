import { getConf, setConf } from '@jbrowse/core/configuration'
import { getEnv, openFeatureWidget } from '@jbrowse/core/util'
import {
  ScoreFieldConfigMixin,
  autoscaleDomainFromStats,
  computeScoreStats,
  visibleStatsRange,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import { markOf, renderingOf } from '../renderingTypes.ts'
import { wiggleFeatureWidgetData } from './wiggleHitTest.ts'

import type { WiggleRendering } from '../renderingTypes.ts'
import type { WiggleHoveredFeature } from '../util.ts'
import type { summaryScoreModeConfigSchemaFields } from './summaryScoreModeConfigSchemaFields.ts'
import type { wiggleConfigSchemaFields } from './wiggleConfigSchemaFields.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { RegionStoreSelf } from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

/**
 * The slots this mixin reads that no shared table can hold: each wiggle
 * display gives `mark` and `interpolate` its own enum and default. A runtime
 * value so `RestatedMixinSlots.test.ts` can check the restated types;
 * `defaultValue` is a placeholder.
 */
export const wiggleCommonExtraSlots = {
  mark: { type: 'stringEnum', defaultValue: '' },
  interpolate: { type: 'stringEnum', defaultValue: '' },
} as const

type WiggleCommonConfigModel = ConfigModelForFields<
  typeof wiggleConfigSchemaFields &
    ReturnType<typeof summaryScoreModeConfigSchemaFields> &
    typeof wiggleCommonExtraSlots
>

/** The whole of what `WiggleCommonMixin` needs a composing display to be. */
export type WiggleCommonHost = { configuration: WiggleCommonConfigModel }

const confNode = (self: object) => self as WiggleCommonHost

const regionHost = (self: object) => (self as { host: RegionHost }).host
const ownAdapterConfig = (self: object) =>
  (self as { adapterConfig: { type: string } }).adapterConfig

// `MultiRegionDisplayMixin`'s per-region store, which both composers of this
// mixin bring and this one only reads through.
const regionStore = (self: object) => self as RegionStoreSelf

// Resolution multiplies the bins fetched, stepped by `RESOLUTION_STEP`. Only
// the coarse side needs a floor; past raw per-base data a finer request returns
// the same bins, so the ceiling is only high. The track-menu stepper disables
// at the edges `setResolution` clamps to.
export const RESOLUTION_MIN = 1 / 16
export const RESOLUTION_MAX = 1024
export const RESOLUTION_STEP = 2

/**
 * #stateModel WiggleCommonMixin
 * #category display
 *
 * Extends `ScoreFieldConfigMixin` with the narrowed rpcDataMap, the autoscale
 * domain and the wiggle-specific config: the origin, rendering type,
 * summary mode, resolution and the line/gap settings. Extended on this chain
 * with `.props()`/`.views()` rather than a mixin composed in, so no
 * `types.compose` layer is added (ADR-041).
 *
 * Used by LinearWiggleDisplay and gccontent's two GC displays.
 */
export function WiggleCommonMixin() {
  return ScoreFieldConfigMixin()
    .views(self => ({
      /**
       * #getter
       * Points per pixel the fetch asks for, clamped to what the Resolution
       * menu offers: the slot is reachable from a track config, which runs no
       * setter, and `0` there divides by zero inside the adapter.
       */
      get resolution(): number {
        return Math.min(
          RESOLUTION_MAX,
          Math.max(RESOLUTION_MIN, getConf(confNode(self), 'resolution')),
        )
      },
      /**
       * #getter
       * The fetched scores, keyed by displayedRegionIndex — the foundation's
       * per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, WiggleDataResult> {
        return regionStore(self).regionPayloads as ReadonlyMap<
          number,
          WiggleDataResult
        >
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The value bars grow from, which a colour scale also reads where its
       * own domain says nothing.
       */
      get origin(): number {
        return getConf(confNode(self), 'origin')
      },
      /**
       * #getter
       */
      get lineWidth(): number {
        return getConf(confNode(self), 'lineWidth')
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
      get renderingType(): WiggleRendering {
        return renderingOf(
          getConf(confNode(self), 'mark'),
          getConf(confNode(self), 'interpolate'),
        )
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
       * `undefined` means every fetched source. The wiggle display always
       * fetches all sources and filters client-side, so it overrides this to
       * the visible subset — otherwise a subtree filter that hides sources
       * would leave the Y-axis scaled to the hidden ones.
       */
      get autoscaleSourceNames(): Set<string> | undefined {
        return undefined
      },
    }))
    .views(() => ({
      /**
       * #getter
       * Scores the axis must reach whatever the data does, so a rule drawn at
       * one stays on it. `[]` here and overridden by the display that draws
       * `scales.y.rules`.
       */
      get scoreRuleValues(): number[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * What the sources visible in the settled blocks span, under the
       * autoscale mode. `undefined` until the view and the data are ready,
       * which is not the `[0, 1]` a caller falls back to — see
       * `visibleStatsRange`.
       */
      get autoscaleRange() {
        const names = self.autoscaleSourceNames
        return visibleStatsRange({
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
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get domain() {
        return self.autoscaledDomain
      },
      /**
       * #getter
       * The bounds the adapter declares its values lie in, where it declares
       * any (`getValueDomain`): a GC content track's [0, 1], so its axis
       * reads alike at every locus. Config bounds still win.
       */
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        for (const data of self.rpcDataMap.values()) {
          if (data.valueDomain) {
            return data.valueDomain
          }
        }
        return [undefined, undefined]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Stage a region as fetched, with this mixin's payload shape — so a test
       * stands up a loaded display in one call. Production goes through
       * `ctx.commitRegion`.
       */
      setRpcData(
        displayedRegionIndex: number,
        data: WiggleDataResult,
        region: Region,
      ) {
        regionStore(self).setLoadedRegion(displayedRegionIndex, region, data)
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
        setConf(
          confNode(self),
          'resolution',
          Math.min(RESOLUTION_MAX, Math.max(RESOLUTION_MIN, res)),
        )
      },
      /**
       * #action
       */
      setOrigin(val?: number) {
        setConf(confNode(self), 'origin', val)
      },
      /**
       * #action
       */
      setRenderingType(type: string) {
        const written = markOf(type)
        if (written) {
          setConf(confNode(self), 'mark', written.mark)
          if (written.interpolate) {
            setConf(confNode(self), 'interpolate', written.interpolate)
          }
        }
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
}
