import { getConf, resolveConf, setConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type {
  AnyConfigurationModel,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The mixin composes onto a display that supplies these props, but they're
// declared by the concrete display, not here, so `self` isn't typed with them.
// This is the shared read/write handle for `getConf`, `setConf` and
// `resolveConf`. Mirrors TrackHeightMixin's cast idiom. Slot names go unchecked
// here because `AnyConfigurationModel` is widened, unlike in a display whose
// factory pins its schema.
//
// It extends `ResolvableDisplay` rather than declaring `configuration` alone
// because two of the slots read through it (`scatterPointSize`, `lineWidth`) are
// promotable, and the cascade keys the session-wide tier on `type`. Every display
// this composes onto is a BaseDisplay, so both members are really there — the
// cast is about what the *mixin* can see, not about what the node has.
type ConfNode = ResolvableDisplay & {
  configuration: AnyConfigurationModel
}
const confNode = (self: object) => self as ConfNode

// Resolution is a multiplier on the number of bins fetched (higher = finer),
// stepped multiplicatively. Only the coarser side needs a floor to avoid
// degenerate binning; the finer side is self-limiting (bbi caps at raw
// per-base data, so past that threshold more resolution returns identical
// data), and the high ceiling lets whiskers reach raw at wider zooms. Exported
// so the track-menu stepper disables at the same edges setResolution clamps to
// instead of silently no-op'ing.
export const RESOLUTION_MIN = 1 / 16
export const RESOLUTION_MAX = 1024
export const RESOLUTION_STEP = 2

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * Score/scale/color config and isCacheValid for wiggle-family displays. Does
 * NOT include rpcDataMap or autoscale domain computation — those live in
 * WiggleCommonMixin, which composes this. Displays that own their own
 * rpcDataMap type (e.g. LinearManhattanDisplay) should compose this instead.
 */
export function WiggleScoreConfigMixin() {
  return types
    .model('WiggleScoreConfigMixin', {
      /**
       * #property
       */
      resolution: types.stripDefault(types.number, 1),
      /**
       * #property
       */
      displayCrossHatches: types.stripDefault(types.boolean, false),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      loadedBpPerPx: undefined as number | undefined,
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
      get scaleType(): string {
        return getConf(confNode(self), 'scaleType')
      },
      /**
       * #getter
       */
      get autoscaleType(): string {
        return getConf(confNode(self), 'autoscale')
      },
      /**
       * #getter
       */
      get numStdDev(): number {
        return getConf(confNode(self), 'numStdDev')
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
      get scatterPointSize(): number {
        return resolveConf(confNode(self), 'scatterPointSize')
      },
      /**
       * #getter
       */
      get lineWidth(): number {
        return resolveConf(confNode(self), 'lineWidth')
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
       * Whether score maps to color instead of height. Each display overrides
       * this from its own rendering-type table (`density` /
       * `multirowdensity`); the base is false so this mixin's resolved
       * getters below can key on it, the same override idiom
       * `autoscaleSourceNames` uses in WiggleCommonMixin.
       */
      get isDensityMode(): boolean {
        return false
      },
      /**
       * #getter
       */
      get minScore(): number {
        return getConf(confNode(self), 'minScore')
      },
      /**
       * #getter
       */
      get maxScore(): number {
        return getConf(confNode(self), 'maxScore')
      },
      /**
       * #getter
       */
      get minScoreBound(): number | undefined {
        const val: number = getConf(confNode(self), 'minScore')
        return val === Number.MIN_VALUE ? undefined : val
      },
      /**
       * #getter
       */
      get maxScoreBound(): number | undefined {
        const val: number = getConf(confNode(self), 'maxScore')
        return val === Number.MAX_VALUE ? undefined : val
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
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
      setLoadedBpPerPx(bpPerPx: number | undefined) {
        self.loadedBpPerPx = bpPerPx
      },
      /**
       * #action
       */
      setScaleType(scaleType: string) {
        setConf(confNode(self), 'scaleType', scaleType)
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
      setMinScore(val?: number) {
        setConf(confNode(self), 'minScore', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        setConf(confNode(self), 'maxScore', val)
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
      setScatterPointSize(val?: number) {
        setConf(confNode(self), 'scatterPointSize', val)
      },
      /**
       * #action
       */
      setLineWidth(val?: number) {
        setConf(confNode(self), 'lineWidth', val)
      },
      /**
       * #action
       */
      setAutoscale(val?: string) {
        setConf(confNode(self), 'autoscale', val)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Strict zoom equality: see adr-008. A view, not an action, so the
       * `view.bpPerPx` read below actually registers as a dependency of whoever
       * calls it (see MultiRegionDisplayMixin's hook block).
       */
      isCacheValid(_displayedRegionIndex: number) {
        if (self.loadedBpPerPx === undefined) {
          return true
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.bpPerPx === self.loadedBpPerPx
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
       * Whether the score-axis cross hatches draw. Density spends color, not
       * height, on the score, so there is no axis for them to rule — and the
       * track menu drops the toggle there, which would strand hatches enabled
       * in another plot type with no way to turn them off. Every consumer
       * (on-screen overlay, multi-row overlay lines, SVG export) reads this,
       * never the raw `displayCrossHatches` prop.
       */
      get showCrossHatches() {
        return self.displayCrossHatches && !self.isDensityMode
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
        return self.isDensityMode && self.summaryScoreMode === 'whiskers'
          ? 'avg'
          : self.summaryScoreMode
      },
    }))
}
