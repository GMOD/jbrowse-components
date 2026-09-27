import {
  getConf,
  getSlotDefinition,
  readConfObject,
  setConf,
  slotChoices,
} from '@jbrowse/core/configuration'
import { DEFAULT_CLIP_QUANTILE } from '@jbrowse/core/util/quantileExtent'
import { rulesABand } from '@jbrowse/display-ui/axisPlacement'

import { ScoreAxisMixin } from './ScoreAxisMixin.ts'

import type {
  ValueScaleRuleConfig,
  scalesSchema,
} from './valueScaleConfigSchema.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { ValueScaleRule } from '@jbrowse/display-ui'

/**
 * The whole of what `ScoreScaleMixin` needs a composing display to be: a
 * `scales` object holding the `y` the value-scale factory built. Exported
 * because it is the mixin's contract and `ScoreScaleMixin.test.ts` pins it:
 * widen it and the `@ts-expect-error`s there go unused.
 */
export interface ScoreScaleHost {
  configuration: ConfigModelForFields<{
    scales: ReturnType<typeof scalesSchema>
  }>
}

// The mixin composes onto a display that declares this, not the other way
// round, so its own `self` isn't typed with it. Cast once, narrowed to the
// factory's schema rather than `AnyConfigurationModel`, which is what keeps the
// member names below checked.
const confNode = (self: object) => self as ScoreScaleHost

/**
 * #stateModel ScoreScaleMixin
 * #category display
 * #crossCuttingMixin Value scale, written in `scales.y`. `valueScaleSchema` / `scalesSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleTypeChoices` / `domainQuantile` / `clipQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume
 *
 * The value scale of every quantitative display: wiggle, the alignments
 * coverage band and the mark display, Manhattan among them, each declare
 * `scales.y` through {@link valueScaleSchema} and compose this. It backs
 * {@link ScoreAxisMixin}'s three overridable members off that object and adds
 * the setters that write it, so composing this is how a display satisfies
 * {@link ScoreScaleModel} in `scoreMenuItems.ts` — the interface the shared
 * Score menu, the scale and autoscale submenus and `SetMinMaxDialog` consume.
 *
 * What a display's scale offers follows what it draws: `symlogConstant`
 * answers `undefined` wherever `symlog` is not among the scale types, and
 * `scaleTypeChoices` reads the declared enum back, which is what the
 * scale-type radio offers.
 *
 * Deliberately just the scale and the guides it owns. Colors, `resolution`
 * and the autoscale *computation* stay in `WiggleScoreConfigMixin` /
 * `WiggleCommonMixin` — the alignments coverage band shares this scale but
 * none of the rest.
 */
export function ScoreScaleMixin() {
  return ScoreAxisMixin()
    .views(self => ({
      /**
       * #getter
       */
      get scaleType(): string {
        return getConf(confNode(self), ['scales', 'y', 'type'])
      },
      /**
       * #getter
       * The scale types this display's own enum admits, which is what the
       * scale-type radio offers; a display with one draws no radio.
       */
      get scaleTypeChoices(): string[] {
        return (
          slotChoices(
            getSlotDefinition(confNode(self).configuration.scales.y, 'type'),
          ) ?? []
        )
      },
      /**
       * #getter
       * `scales.y.domainQuantile`: what an unpinned end follows, 1 the
       * extremes and below it that quantile of each sign.
       */
      get domainQuantile(): number {
        return getConf(confNode(self), ['scales', 'y', 'domainQuantile'])
      },
      /**
       * #getter
       * The quantile "Clip outliers" clips at: the scale's own default where
       * that is below 1, else 0.99.
       */
      get clipQuantile(): number {
        const declared = getSlotDefinition(
          confNode(self).configuration.scales.y,
          'domainQuantile',
        ).defaultValue
        return typeof declared === 'number' && declared < 1
          ? declared
          : DEFAULT_CLIP_QUANTILE
      },
      /**
       * #getter
       * Raw slot; `0` means "derive from the domain". Resolve it with
       * `resolveSymlogConstant` once the domain is known.
       */
      get symlogConstant(): number {
        return getConf(confNode(self), ['scales', 'y', 'symlogConstant'])
      },
      /**
       * #getter
       * The lower bound the config pins, `undefined` where it pins none.
       */
      get manualMinScore(): number | undefined {
        return getConf(confNode(self), ['scales', 'y', 'domainMin'])
      },
      /**
       * #getter
       * The upper bound the config pins, `undefined` where it pins none.
       */
      get manualMaxScore(): number | undefined {
        return getConf(confNode(self), ['scales', 'y', 'domainMax'])
      },
      /**
       * #getter
       * `scales.y.autoscaleGroup`, `undefined` while it names none.
       */
      get autoscaleGroup(): string | undefined {
        return (
          getConf(confNode(self), ['scales', 'y', 'autoscaleGroup']) ||
          undefined
        )
      },
      /**
       * #getter
       * `scales.y.title`, `''` while unset
       */
      get scaleTitle(): string {
        return getConf(confNode(self), ['scales', 'y', 'title']) ?? ''
      },
      /**
       * #getter
       * `scales.y.grid`
       */
      get grid(): boolean {
        return getConf(confNode(self), ['scales', 'y', 'grid'])
      },
      /**
       * #getter
       * `scales.y.minimalTicks`
       */
      get minimalTicks(): boolean {
        return getConf(confNode(self), ['scales', 'y', 'minimalTicks'])
      },
      /**
       * #getter
       * Whether this display draws `scales.y.rules`, which is whether the
       * score menu offers the reference lines: a scale it places y through
       * rules a band for them to cross, which a density plot's colour-mapped
       * rows and a colour ramp do not.
       */
      get scoreRulesDrawn(): boolean {
        return self.valueScales.some(rulesABand)
      },
      /**
       * #getter
       * `scales.y.rules`, read off the live nodes: a snapshot strips a slot at
       * its default, and a rule at 0 is one.
       */
      get scoreRules(): ValueScaleRule[] {
        const { rules } = confNode(self).configuration.scales.y
        return rules.map((rule: ValueScaleRuleConfig) => {
          const label = readConfObject(rule, 'label')
          const color = readConfObject(rule, 'color')
          return {
            value: readConfObject(rule, 'value'),
            ...(color ? { color } : {}),
            ...(label ? { label } : {}),
          }
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setScaleType(scaleType: string) {
        setConf(confNode(self), ['scales', 'y', 'type'], scaleType)
      },
      /**
       * #action
       */
      setDomainQuantile(quantile: number) {
        setConf(confNode(self), ['scales', 'y', 'domainQuantile'], quantile)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        setConf(confNode(self), ['scales', 'y', 'domainMin'], val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        setConf(confNode(self), ['scales', 'y', 'domainMax'], val)
      },
      /**
       * #action
       */
      setAutoscaleGroup(group?: string) {
        setConf(confNode(self), ['scales', 'y', 'autoscaleGroup'], group)
      },
      /**
       * #action
       */
      setGrid(grid: boolean) {
        setConf(confNode(self), ['scales', 'y', 'grid'], grid)
      },
      /**
       * #action
       * Replaces `scales.y.rules` whole, each entry in a form the config
       * takes: a number, or `{ value, color, label }`.
       */
      setScoreRules(rules: (number | ValueScaleRule)[]) {
        setConf(confNode(self), ['scales', 'y', 'rules'], rules)
      },
    }))
}
