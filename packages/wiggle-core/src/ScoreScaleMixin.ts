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
import { confNodeAt, readYMember, yRuleNodes } from './yScaleRead.ts'

import type { scalesSchema } from './valueScaleConfigSchema.ts'
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
  return readYMember(confOf(self), paths, member)
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
 * #crossCuttingMixin Value scale, written in `scales.y` or a `YScalePaths` map's paths (the coverage band's `coverage.encoding.y`). `valueScaleSchema` / `scalesSchema` / `yChannelSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleZero` / `domainQuantile` / `clipQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the Y axis row and its drawer widget consume
 *
 * The value scale of every quantitative display: wiggle and the mark
 * display, Manhattan among them, declare `scales.y` through
 * {@link valueScaleSchema}, and the alignments, LGVSynteny and MAF coverage
 * band `coverage.encoding.y` through {@link yChannelSchema}; each composes
 * this with the map to its members. It backs
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
       * The y scale's `zero`: whether an autoscaled linear or symlog axis reaches
       * 0.
       */
      get scaleZero(): boolean {
        return readY(self, paths, 'zero')
      },
      /**
       * #getter
       * The y scale's fence quantile: what an unpinned end follows, 1 the
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
              confNodeAt(confOf(self), paths.members.fence.slice(0, -1)),
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
       * The y scale's autoscale group, `undefined` while it names none.
       */
      get autoscaleGroup(): string | undefined {
        return readY(self, paths, 'group') || undefined
      },
      /**
       * #getter
       * The y axis title, `''` while unset
       */
      get scaleTitle(): string {
        return readY(self, paths, 'title') ?? ''
      },
      /**
       * #getter
       * The y axis grid
       */
      get grid(): boolean {
        return readY(self, paths, 'grid')
      },
      /**
       * #getter
       * The y axis' minimal ticks, `false` where the display has none
       */
      get minimalTicks(): boolean {
        return readY(self, paths, 'minimalTicks') ?? false
      },
      /**
       * #getter
       * Whether this display draws the y scale's rules, which is whether the
       * Y axis panel offers Include 0 and the reference lines: a scale it places y through
       * rules a band for them to cross, which a density plot's color-mapped
       * rows and a color ramp do not.
       */
      get scoreRulesDrawn(): boolean {
        return self.valueScales.some(rulesABand)
      },
      /**
       * #getter
       * The y scale's rules, read off the live nodes.
       */
      get scoreRules(): ValueScaleRule[] {
        return yRuleNodes(confOf(self), paths).map(rule => {
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
       * Replaces the y scale's rules whole, each entry in a form the config
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
