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

/**
 * The identifier prop a schema declares **or inherits** — `trackId`,
 * `displayId`, or whatever `explicitIdentifier` names. Recursive because most
 * display schemas never declare it themselves: they pick up `displayId` from
 * `baseConfiguration: baseLinearDisplayConfigSchema`, whose options
 * `preprocessConfigurationSchemaArguments` merges in at runtime, leaving the
 * subclass's own `EXPLICIT_IDENTIFIER` param `undefined`. Same walk
 * `ConfigurationSlotName` does for inherited slot names.
 */
export type GetInheritedIdentifier<SCHEMA> = SCHEMA extends undefined
  ? never
  : SCHEMA extends ConfigurationSchemaType<any, any>
    ?
        | GetExplicitIdentifier<SCHEMA>
        | (GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
            ? GetInheritedIdentifier<GetBase<SCHEMA>>
            : never)
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
// A slot declaring `promotedBase` is a *sentinel* slot: being unset is the
// "inherit" signal, which only `resolveConf` resolves away (every promotable slot
// is a `maybe*` type, so the sentinel is always `undefined`). So the *resolved*
// read type drops it — `boolean | undefined` becomes `boolean`,
// `'fixed' | 'grow' | 'fit' | undefined` becomes `'fixed' | 'grow' | 'fit'`.
//
// The plain `getConf` read type keeps the `undefined` (see
// `ConfigurationSlotValue` below), which is the whole compile-time guard: read a
// promotable slot with the raw reader and you get a type you can't hand to a
// consumer expecting a real mode, so tsc points at the call that should have
// been `resolveConf`. A slot without `promotedBase` is unaffected either way.
//
// `promotedBase` is the marker at runtime too now, so this mapping and
// `ConfigSlot` finally read the same field. They never used to: a separate
// `promotable` boolean cannot be read here at all, because this sees the
// subclass's *literal* definition while the boolean arrives through
// `mergeSchemaDefinition` at runtime — a real override states `promotedBase` and
// inherits the rest (`LGVSyntenyDisplay`'s `colorBy`). Two `ConfigSlot` throws
// existed only to force the two fields to agree; deleting the boolean deleted
// them.
//
// **`promotedBase: undefined` has to be checked first, and it is not a no-op
// branch.** It is how a subclass turns an inherited promotable slot back into a
// plain one — the definition merge is a spread, so a stated `undefined`
// overwrites the base's value at runtime. But `{ promotedBase: undefined }` does
// satisfy `{ promotedBase: unknown }`, so without this branch the type would
// keep resolving the sentinel away for exactly the slot that just stopped being
// promotable, and `resolveConf` would throw on a read tsc had blessed.
type SlotValueResolvedFromDef<DEF> = DEF extends { promotedBase: undefined }
  ? SlotValueRawFromDef<DEF>
  : DEF extends { promotedBase: unknown }
    ? Exclude<SlotValueRawFromDef<DEF>, undefined>
    : SlotValueRawFromDef<DEF>

// A sub-schema entry, not a slot: the read yields that sub-config's snapshot.
// Typed rather than left to fall through to `any`, so the snapshot can't be fed
// back into `readConfObject` — see its doc comment.
type SlotValueRawFromDef<DEF> = DEF extends AnyConfigurationSchemaType
  ? AnyConfigurationSnapshot
  : DEF extends {
        model: ISimpleType<infer T extends string>
      }
    ? // `maybeStringEnum` declares the plain enumeration as its `model` and gets
      // its nullability from ConfigSlot, so the `undefined` is added back here
      DEF extends { type: 'maybeStringEnum' }
      ? T | undefined
      : T
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
                  : // the `maybe*` form of `frozen`, and `any` for the same
                    // reason: arbitrary dynamic JSON whose shape the caller
                    // asserts at the read boundary. Listed rather than left to
                    // the `defaultValue` fallback below, which only lands on
                    // `any` by accident (a promotable slot's default is always
                    // the `undefined` sentinel).
                    DEF extends { type: 'maybeFrozen' }
                    ? any
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

/** what a raw read (`getConf` / `readConfObject`) of this slot yields */
export type ConfigurationSlotValue<SCHEMA, K extends string> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? K extends keyof D
      ? SlotValueRawFromDef<D[K]>
      : GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
        ? ConfigurationSlotValue<GetBase<SCHEMA>, K>
        : any
    : any

/**
 * what `resolveConf` yields: the same, minus the inherit sentinel on a
 * promotable slot — the cascade always produces a real value.
 */
export type ConfigurationSlotValueResolved<SCHEMA, K extends string> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? K extends keyof D
      ? SlotValueResolvedFromDef<D[K]>
      : GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
        ? ConfigurationSlotValueResolved<GetBase<SCHEMA>, K>
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
