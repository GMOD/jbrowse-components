import {
  getSlotDefinition,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'
import { persistTrackConfigNow } from '@jbrowse/core/util/mstUtils'
import { clipQuantileOf } from '@jbrowse/core/util/quantileExtent'
import { rulesABand } from '@jbrowse/display-ui/axisPlacement'

import { ScoreAxisMixin } from './ScoreAxisMixin.ts'
import { SCALES_Y_PATHS } from './yScalePaths.ts'

import type {
  ValueScaleRuleConfig,
  scalesSchema,
} from './valueScaleConfigSchema.ts'
import type { YMember, YScalePaths } from './yScalePaths.ts'
import type {
  AnyConfigurationModel,
  ConfigModelForFields,
  ConfigurationSchemaForModel,
  ConfigurationSlotPath,
} from '@jbrowse/core/configuration'
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

export type ScoreScaleHostPath = ConfigurationSlotPath<
  ConfigurationSchemaForModel<ScoreScaleHost['configuration']>
>

// A mistyped segment in the default map fails here, since the reads below go
// through `readonly string[]` and no longer check the names themselves.
Object.values(SCALES_Y_PATHS.members) satisfies readonly ScoreScaleHostPath[]

// The mixin composes onto a display that declares the scale, not the other way
// round, so its own `self` isn't typed with it.
const confOf = (self: object) =>
  (self as { configuration: AnyConfigurationModel }).configuration

function readY(self: object, paths: YScalePaths, member: YMember) {
  const path = paths.members[member]
  return path && readConfObject(confOf(self), [...path])
}

// the config node a path ends on, for what a snapshot read cannot give
function nodeAt(conf: AnyConfigurationModel, path: readonly string[]) {
  return path.reduce<unknown>(
    (node, segment) => (node as Record<string, unknown>)[segment],
    conf,
  ) as AnyConfigurationModel
}

function valueAt(root: unknown, path: readonly string[]) {
  return path.reduce(
    (node, segment) => (node as Record<string, unknown> | undefined)?.[segment],
    root,
  )
}

// writeAxis saves the track to the session at once, so each axis edit is its
// own undo step whichever caller makes it (ADR-157).
function writeAxis(
  self: object,
  paths: YScalePaths,
  member: YMember,
  value: unknown,
) {
  setConf(
    { configuration: confOf(self) },
    [...paths.members[member]!] as never,
    value,
  )
  persistTrackConfigNow(self)
}

/**
 * #stateModel ScoreScaleMixin
 * #category display
 * #crossCuttingMixin Value scale, written in `scales.y`. `valueScaleSchema` / `scalesSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleZero` / `domainQuantile` / `clipQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the Y axis row and its drawer widget consume
 *
 * The value scale of every quantitative display: wiggle, the alignments
 * coverage band and the mark display, Manhattan among them, each declare
 * `scales.y` through {@link valueScaleSchema} and compose this. It backs
 * {@link ScoreAxisMixin}'s three overridable members off that object and adds
 * the setters that write it, so composing this is how a display satisfies
 * {@link ScoreScaleModel} in `scoreMenuItems.ts` — the interface the Y axis
 * row and its drawer widget consume.
 *
 * Deliberately just the scale and the guides it owns. Colors, `resolution`
 * and the autoscale *computation* stay in `WiggleScoreConfigMixin` /
 * `WiggleCommonMixin` — the alignments coverage band shares this scale but
 * none of the rest.
 */
export function ScoreScaleMixin(paths: YScalePaths = SCALES_Y_PATHS) {
  return ScoreAxisMixin()
    .volatile(() => ({
      unclippedQuantile: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get scaleType(): string {
        return readY(self, paths, 'type')
      },
      /**
       * #getter
       * `scales.y.zero`: whether an autoscaled linear or symlog axis reaches
       * 0.
       */
      get scaleZero(): boolean {
        return readY(self, paths, 'zero')
      },
      /**
       * #getter
       * `scales.y.domainQuantile`: what an unpinned end follows, 1 the
       * extremes and below it that quantile of each sign.
       */
      get domainQuantile(): number {
        return readY(self, paths, 'fence')
      },
      /**
       * #getter
       * The quantile "Clip extreme outliers" fences at: the one an untick this session
       * wrote over, else the scale's own default where that is below 1, else
       * 0.99.
       */
      get clipQuantile(): number {
        return (
          self.unclippedQuantile ??
          clipQuantileOf(
            getSlotDefinition(
              nodeAt(confOf(self), paths.members.fence.slice(0, -1)),
              paths.members.fence.at(-1)!,
            ).defaultValue,
          )
        )
      },
      /**
       * #getter
       * Raw slot; `0` means "derive from the domain". Resolve it with
       * `resolveSymlogConstant` once the domain is known.
       */
      get symlogConstant(): number {
        return readY(self, paths, 'constant')
      },
      /**
       * #getter
       * The lower bound the config pins, `undefined` where it pins none.
       */
      get manualMinScore(): number | undefined {
        return readY(self, paths, 'domainMin')
      },
      /**
       * #getter
       * The upper bound the config pins, `undefined` where it pins none.
       */
      get manualMaxScore(): number | undefined {
        return readY(self, paths, 'domainMax')
      },
      /**
       * #getter
       * `scales.y.autoscaleGroup`, `undefined` while it names none.
       */
      get autoscaleGroup(): string | undefined {
        return readY(self, paths, 'group') || undefined
      },
      /**
       * #getter
       * `scales.y.title`, `''` while unset
       */
      get scaleTitle(): string {
        return readY(self, paths, 'title') ?? ''
      },
      /**
       * #getter
       * `scales.y.grid`
       */
      get grid(): boolean {
        return readY(self, paths, 'grid')
      },
      /**
       * #getter
       * `scales.y.minimalTicks`
       */
      get minimalTicks(): boolean {
        return readY(self, paths, 'minimalTicks') ?? false
      },
      /**
       * #getter
       * Whether this display draws `scales.y.rules`, which is whether the
       * Y axis panel offers Include 0 and the reference lines: a scale it places y through
       * rules a band for them to cross, which a density plot's color-mapped
       * rows and a color ramp do not.
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
        const rules = nodeAt(
          confOf(self),
          paths.members.rules,
        ) as unknown as ValueScaleRuleConfig[]
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
        writeAxis(self, paths, 'type', scaleType)
      },
      /**
       * #action
       */
      setScaleZero(zero: boolean) {
        writeAxis(self, paths, 'zero', zero)
      },
      /**
       * #action
       */
      setDomainQuantile(quantile: number) {
        if (!(quantile < 1) && self.domainQuantile < 1) {
          self.unclippedQuantile = self.domainQuantile
        }
        writeAxis(self, paths, 'fence', quantile)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        writeAxis(self, paths, 'domainMin', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        writeAxis(self, paths, 'domainMax', val)
      },
      /**
       * #action
       */
      setAutoscaleGroup(group?: string) {
        writeAxis(self, paths, 'group', group)
      },
      /**
       * #action
       */
      setGrid(grid: boolean) {
        writeAxis(self, paths, 'grid', grid)
      },
      /**
       * #action
       * Replaces `scales.y.rules` whole, each entry in a form the config
       * takes: a number, or `{ value, color, label }`.
       */
      setScoreRules(rules: (number | ValueScaleRule)[]) {
        writeAxis(self, paths, 'rules', rules)
      },
      /**
       * #action
       * Back to what the config.json says, or to what a session-owned track
       * was added with, so an admin's declared axis survives a reset; slots the
       * base leaves unset take their defaults.
       */
      resetYScale() {
        const base = baseDisplayConfig(self as never)
        for (const path of paths.reset) {
          setConf(
            { configuration: confOf(self) },
            [...path] as never,
            valueAt(base, path) ?? {},
          )
        }
        persistTrackConfigNow(self)
      },
    }))
}
