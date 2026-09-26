import {
  getConf,
  getSlotDefinition,
  readConfObject,
  setConf,
  slotChoices,
} from '@jbrowse/core/configuration'
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
 * #crossCuttingMixin Value scale, written in `scales.y`. `valueScaleSchema` / `scalesSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleTypeChoices` / `autoscaleType` / `numStdDev` / `numQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume
 *
 * The value scale of every quantitative display: wiggle, Manhattan, the
 * alignments coverage band and the mark display each declare
 * `scales.y` through {@link valueScaleSchema} and compose this. It backs
 * {@link ScoreAxisMixin}'s three overridable members off that object and adds
 * the setters that write it, so composing this is how a display satisfies
 * {@link ScoreScaleModel} in `scoreMenuItems.ts` — the interface the shared
 * Score menu, the scale and autoscale submenus and `SetMinMaxDialog` consume.
 *
 * What a display's scale offers follows what it draws, so the members below
 * answer `undefined` where its factory call left them out: `autoscaleType` on
 * Manhattan, whose domain is plain min/max, and `symlogConstant` wherever
 * `symlog` is not among the scale types. `scaleTypeChoices` reads the declared
 * enum back, which is what the scale-type radio offers.
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
       * `undefined` on a display whose domain consults no autoscale mode.
       */
      get autoscaleType(): string | undefined {
        return getConf(confNode(self), ['scales', 'y', 'autoscale'])
      },
      /**
       * #getter
       */
      get numStdDev(): number {
        return getConf(confNode(self), ['scales', 'y', 'numStdDev'])
      },
      /**
       * #getter
       */
      get numQuantile(): number {
        return getConf(confNode(self), ['scales', 'y', 'numQuantile'])
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
       * `scales.y.title` as written, `undefined` while unset or on a display
       * whose scale declares no title.
       */
      get scaleTitle(): string | undefined {
        return getConf(confNode(self), ['scales', 'y', 'title'])
      },
      /**
       * #getter
       * `scales.y.grid`, false on a display whose scale declares none.
       */
      get grid(): boolean {
        return getConf(confNode(self), ['scales', 'y', 'grid']) ?? false
      },
      /**
       * #getter
       * `scales.y.minimalTicks`, false on a display whose scale declares none.
       */
      get minimalTicks(): boolean {
        return getConf(confNode(self), ['scales', 'y', 'minimalTicks']) ?? false
      },
      /**
       * #getter
       * Whether this display draws `scales.y.rules`, which is whether the
       * score menu offers the reference lines: its scale declares them, and
       * a scale it places y through rules a band for them to cross, which a
       * density plot's colour-mapped rows and a colour ramp do not.
       */
      get scoreRulesDrawn(): boolean {
        return (
          confNode(self).configuration.scales.y.rules !== undefined &&
          self.valueScales.some(rulesABand)
        )
      },
      /**
       * #getter
       * `scales.y.rules`, read off the live nodes: a snapshot strips a slot at
       * its default, and a rule at 0 is one. Empty on a display whose scale
       * declares no rules.
       */
      get scoreRules(): ValueScaleRule[] {
        const { rules = [] } = confNode(self).configuration.scales.y
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
      setAutoscale(val?: string) {
        setConf(confNode(self), ['scales', 'y', 'autoscale'], val)
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
