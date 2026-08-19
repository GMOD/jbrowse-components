import type { FileLocation } from '../util/types/index.ts'
import type {
  ConfigurationSchemaDefinition,
  ConfigurationSchemaOptions,
  ConfigurationSchemaType,
} from './configurationSchema.ts'
import type { BuiltinSlotTypeName } from './configurationSlot.ts'
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
    ? // this provides the ability to type check names in the config readConfObject usage
      // it is not commonly used but retained for now with this lint ignore

      | (keyof D & string)
      | GetExplicitIdentifier<SCHEMA>
      | (GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
          ? ConfigurationSlotName<GetBase<SCHEMA>>
          : never)
    : never

/**
 * The names a config snapshot for `SCHEMA` may use — its own slots, its
 * sub-schemas recursively, its identifier and everything it inherits — with
 * every value left `unknown`.
 *
 * Names are the whole point of it. A slot value can be its own type, a `jexl:`
 * callback string, or (for a promotable slot) absent, and nothing here tries to
 * check that; a *name* the schema does not declare is dropped on the way in
 * without a word, so `preferance` is a setting that reads as applied and never
 * applies. Against an object literal — which is how an embedder writes one —
 * TypeScript's excess-property check turns that into a compile error.
 */
export type ConfigurationSnapshot<SCHEMA> = SCHEMA extends undefined
  ? never
  : SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? {
        [K in keyof D]?: D[K] extends ConfigurationSchemaType<any, any>
          ? ConfigurationSnapshot<D[K]>
          : unknown
      } & {
        [K in GetExplicitIdentifier<SCHEMA>]?: string
      } & (GetBase<SCHEMA> extends ConfigurationSchemaType<any, any>
          ? ConfigurationSnapshot<GetBase<SCHEMA>>
          : unknown)
    : unknown

// Value type of a single slot, keyed on the slot's literal `type` — which the
// `const DEFINITION` param on `ConfigurationSchema` is what preserves through
// inference. `SlotValueRawFromDef` and `SlotValueByType` below are the mapping;
// two things it does that aren't obvious from reading them:
// - a `stringEnum` is read off `model` (the author's `types.enumeration`) rather
//   than the table, which recovers 'normal' | 'compact' instead of `string`.
// - every `maybe*` type becomes `T | undefined`, surfacing the unset state at
//   each read instead of hiding it behind `any`.
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
// This mapping sees the subclass's **literal** definition, so anything a schema
// gains at runtime through `mergeSchemaDefinition` is invisible here — a real
// override states `promotedBase` and inherits the rest (`LGVSyntenyDisplay`'s
// `colorBy`), which is why the marker has to be a field this can read.
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

/**
 * The value each builtin slot `type` reads as — the type-level twin of
 * `slotTypes` in `configurationSlot.ts`, which is the same list as MST models.
 * A table rather than the fourteen-deep conditional staircase this used to be:
 * adding a slot type is now one row here and one there, and the two tables sit
 * side by side where a name present in one and missing from the other is
 * visible. Missing a row is not silent either — it drops the slot to the
 * `defaultValue` fallback below, which is what `SlotValueRawFromDef` documents.
 *
 * `stringEnum`/`maybeStringEnum` are deliberately absent: their value type comes
 * from the author's own `types.enumeration`, read off `model` before this table
 * is consulted.
 */
interface SlotValueByType {
  stringArray: string[]
  stringArrayMap: Record<string, string[]>
  numberMap: Record<string, number>
  fileLocation: FileLocation
  maybeNumber: number | undefined
  maybeBoolean: boolean | undefined
  maybeColor: string | undefined
  /**
   * `frozen` and its `maybe*` form are `any` deliberately — arbitrary dynamic
   * JSON whose shape the caller asserts at the read boundary. `unknown` would
   * only add cast ceremony on values that are legitimately dynamic.
   *
   * Stated here rather than left to the `defaultValue` fallback, which reaches
   * `any` for these only by accident: it lands there because no `frozen` slot in
   * the repo happens to default to a scalar, and a promotable slot's default is
   * always the `undefined` sentinel.
   */
  frozen: any
  maybeFrozen: any
  number: number
  integer: number
  boolean: boolean
  string: string
  text: string
  color: string
}

/**
 * The two tables name the same builtin slot types, checked rather than
 * remembered.
 *
 * A row present in one and missing from the other is otherwise **not** an
 * error: the slot drops through to `SlotValueRawFromDef`'s `defaultValue`
 * fallback, which re-widens a scalar default but reaches `any` for everything
 * else — so a new `stringArray`-shaped type would silently read as `any` at
 * every call site. The "every builtin slot type reads as its declared value
 * type" case in `configTypeNarrowing.test.ts` lists the rows by hand, so it
 * only catches the drift if whoever adds the type also edits the test; this
 * catches it either way.
 */
type MutuallyExtends<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
type Assert<T extends true> = T
export type SlotValueTableCoversBuiltinSlotTypes = Assert<
  MutuallyExtends<BuiltinSlotTypeName, keyof SlotValueByType>
>

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
    : // A slot whose `type` names a row of the table above. The constrained
      // `infer` is what makes this one branch instead of fourteen, and it keeps
      // a multi-name row honest: `type: 'number' | 'integer'` infers that union
      // and indexes to `number | number`, i.e. `number`. A `type` that isn't a
      // row — a custom `model` whose value isn't a string enum, or a `type`
      // widened to `string` because the schema wasn't inferred `const` — fails
      // the constraint and falls through.
      DEF extends { type: infer T extends keyof SlotValueByType }
      ? SlotValueByType[T]
      : // Last resort: re-widen the slot's literal `defaultValue` to its base
        // scalar type. Only reached by a slot the table doesn't name, and note
        // it is *not* how the scalar rows are served — a numeric or boolean slot
        // can carry a jexl-string `defaultValue` (arc `thickness`'s
        // `jexl:logThickness(...)`), which this would mistype as `string`.
        // `readConfObject` evaluates the jexl on read and yields the slot's
        // declared type, so the table's answer is the one that matches runtime.
        DEF extends { defaultValue: infer V }
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

/**
 * The `XConfigModel` for a **field table** — a `*ConfigSchemaFields` export —
 * rather than for a whole assembled schema. What it is for is the cast a
 * cross-cutting mixin uses to reach the `configuration` its composing display
 * supplies but its own `self` cannot see: cast to `AnyConfigurationModel` there
 * and `getConf`/`setConf` derive their slot-name constraint from a schema
 * widened to `any`, so every name typechecks and a misspelled *read* returns
 * `undefined` with no diagnostic at any layer. Name the mixin's own field table
 * instead and the check comes back, scoped to exactly the slots that mixin owns.
 *
 * `BASE` is for the mixin that also reads a slot off the schema its displays
 * inherit from — `ConfigurationSlotName` walks the base chain, so passing it
 * admits those names too and nothing else (`HeightModeMixin` and `height`).
 *
 * The pairing this depends on is a mixin and its field table living together:
 * `RowHeightMixin` + `rowHeightConfigSchemaFields` is the worked example, and
 * `packages/tree-sidebar/CLAUDE.md` has the reasoning.
 */
export type ConfigModelForFields<
  FIELDS extends ConfigurationSchemaDefinition,
  BASE extends AnyConfigurationSchemaType | undefined = undefined,
> = Instance<
  ConfigurationSchemaType<FIELDS, ConfigurationSchemaOptions<BASE, undefined>>
>

/**
 * `true` when HOST's `configuration` still narrows slot names, `false` when it
 * has widened them back to `string`. One line per mixin pins it:
 *
 * ```ts
 * const pin: HostChecksSlotNames<HeightModeHost> = true
 * ```
 *
 * Worth a named type because the widened form has **no symptom** — a mixin host
 * cast to `AnyConfigurationModel`, or to the `ResolvableDisplay & { … }`
 * intersection that re-widens, compiles and runs and checks nothing. Every
 * misspelled slot name below it typechecks, and a misspelled *read* returns
 * `undefined` with no diagnostic at any layer, so only a sabotage or this
 * assertion tells the two apart.
 */
export type HostChecksSlotNames<
  HOST extends { configuration: AnyConfigurationModel },
> =
  string extends ConfigurationSlotName<
    ConfigurationSchemaForModel<HOST['configuration']>
  >
    ? false
    : true

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
