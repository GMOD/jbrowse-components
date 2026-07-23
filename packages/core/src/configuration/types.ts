import type { FileLocation } from '../util/types/index.ts'
import type {
  ConfigurationSchemaOptions,
  ConfigurationSchemaType,
} from './configurationSchema.ts'
import type {
  ISimpleType,
  IStateTreeNode,
  Instance,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'

export type GetOptions<SCHEMA> =
  SCHEMA extends ConfigurationSchemaType<any, infer OPTIONS> ? OPTIONS : never

export type GetBase<SCHEMA> = SCHEMA extends undefined
  ? never
  : GetOptions<SCHEMA> extends ConfigurationSchemaOptions<undefined, any>
    ? undefined
    : GetOptions<SCHEMA> extends ConfigurationSchemaOptions<
          infer BASE extends AnyConfigurationSchemaType,
          any
        >
      ? BASE
      : never

export type GetExplicitIdentifier<SCHEMA> =
  GetOptions<SCHEMA> extends ConfigurationSchemaOptions<
    any,
    infer EXPLICIT_IDENTIFIER extends string
  >
    ? EXPLICIT_IDENTIFIER
    : never

export type ConfigurationSchemaForModel<MODEL> =
  MODEL extends IStateTreeNode<infer SCHEMA extends AnyConfigurationSchemaType>
    ? SCHEMA
    : never

export type ConfigurationSlotName<SCHEMA> = SCHEMA extends undefined
  ? never
  : SCHEMA extends ConfigurationSchemaType<infer D, any>
    ?
        // this provides the ability to type check names in the config readConfObject usage
        // it is not commonly used but retained for now with this lint ignore

        | (keyof D & string)
        | GetExplicitIdentifier<SCHEMA>
        | (GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
            ? ConfigurationSlotName<GetBase<SCHEMA>>
            : never)
    : never

// Value type of a single slot. Keyed on the slot's literal `type`, which the
// `const DEFINITION` param on `ConfigurationSchema` preserves through inference.
// - `stringEnum` carries its literal union on `model` (a `types.enumeration`),
//   so prefer that — recovers e.g. 'normal' | 'compact' instead of `string`.
// - array/map/fileLocation/maybe* map to their runtime value types
//   (`configurationSlot.ts` typeModels); `maybe*` become `T | undefined`, which
//   surfaces the unset state at every read instead of hiding it behind `any`.
// - scalars key on `type` directly (string/text/color → string; number/integer
//   → number; boolean → boolean). A numeric/boolean slot can carry a jexl-string
//   `defaultValue` (e.g. arc `thickness`'s `jexl:logThickness(...)`), so deriving
//   the value type from the default would mistype it as `string`. `readConfObject`
//   evaluates the jexl on read and returns the slot's declared value type, so the
//   `type`-keyed result is exactly what a read yields.
// - a slot with an unrecognized `type` (a custom `model` whose value isn't a
//   string enum) falls back to re-widening its literal `defaultValue` to the base
//   scalar type.
// - `frozen` stays `any` deliberately: it's the escape hatch for arbitrary
//   dynamic JSON, so callers assert its shape at the read boundary; `unknown`
//   would only add cast ceremony on legitimately-dynamic values.
// jexl callbacks are declared to return the slot's own type, correct here too.
//
// A `promotable` slot with a `promotedBase` is a *sentinel* slot: its
// `defaultValue` is the "inherit" signal (an `'inherit'` enum member, or the
// `undefined` of a `maybe*`), which `getConf` resolves away and never returns.
// So the read type excludes that sentinel — `Exclude<raw, defaultValue>` turns
// e.g. `'inherit' | 'normal' | 'compact'` into `'normal' | 'compact'` and
// `boolean | undefined` into `boolean`, matching what a resolved read yields. A
// slot without `promotedBase` is unaffected (a plain `maybe*` still surfaces its
// `undefined`).
type SlotValueFromDef<DEF> = DEF extends { promotedBase: unknown }
  ? Exclude<
      SlotValueRawFromDef<DEF>,
      DEF extends { defaultValue: infer S } ? S : never
    >
  : SlotValueRawFromDef<DEF>

type SlotValueRawFromDef<DEF> = DEF extends {
  model: ISimpleType<infer T extends string>
}
  ? T
  : DEF extends { type: 'stringArray' }
    ? string[]
    : DEF extends { type: 'stringArrayMap' }
      ? Record<string, string[]>
      : DEF extends { type: 'numberMap' }
        ? Record<string, number>
        : DEF extends { type: 'fileLocation' }
          ? FileLocation
          : DEF extends { type: 'maybeNumber' }
            ? number | undefined
            : DEF extends { type: 'maybeBoolean' }
              ? boolean | undefined
              : DEF extends { type: 'maybeColor' }
                ? string | undefined
                : DEF extends { type: 'number' | 'integer' }
                  ? number
                  : DEF extends { type: 'boolean' }
                    ? boolean
                    : DEF extends { type: 'string' | 'text' | 'color' }
                      ? string
                      : DEF extends { defaultValue: infer V }
                        ? [V] extends [boolean]
                          ? boolean
                          : [V] extends [string]
                            ? string
                            : [V] extends [number]
                              ? number
                              : any
                        : any

export type ConfigurationSlotValue<SCHEMA, K extends string> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? K extends keyof D
      ? SlotValueFromDef<D[K]>
      : GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
        ? ConfigurationSlotValue<GetBase<SCHEMA>, K>
        : any
    : any

/**
 * Naming convention for config types, paired per schema:
 * - `XConfigSchema` is the MST IType (the schema itself). Use it for
 *   `getConf`, `ConfigurationReference`, and factory params — anywhere a schema
 *   is expected.
 * - `XConfigModel` is `Instance<XConfigSchema>` (a resolved config node). Use it
 *   for `readConfObject` results, model fields, and values read off a session.
 *
 * Prefer a named `XConfigModel` alias over inlining `Instance<XConfigSchema>` at
 * call sites. Two historical names predate this convention and stay as-is:
 * `BaseTrackConfig` (the track instance type) and `AnyConfiguration` (a
 * model-or-snapshot union, not a plain instance).
 */
export type AnyConfigurationSchemaType = ConfigurationSchemaType<any, any>
export type AnyConfigurationModel = Instance<AnyConfigurationSchemaType>

/** a plain-object snapshot of a configuration model (not a live MST node) */
export type AnyConfigurationSnapshot = SnapshotOut<AnyConfigurationModel>

/**
 * A value readable as configuration: either a live configuration model or a
 * plain snapshot of one. `session.tracks` legitimately holds a mix (live
 * `sessionTracks` nodes, plus plain frozen/merged base entries that hydrate to
 * MST only on first reference access), and `readConfObject` reads both — so this
 * is the honest type at those boundaries. Reserve `AnyConfigurationModel` for
 * values that must be live (actions, identity, reference resolution).
 */
export type AnyConfiguration = AnyConfigurationModel | AnyConfigurationSnapshot
