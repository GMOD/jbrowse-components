import type { FileLocation } from '../util/types/index.ts'
import type { IsAny } from '../util/types/isAny.ts'
import type {
  ConfigurationSchemaDefinition,
  ConfigurationSchemaOptions,
  ConfigurationSchemaType,
} from './configurationSchema.ts'
import type { BuiltinSlotTypeName } from './configurationSlot.ts'
import type {
  IAnyType,
  IArrayType,
  ISimpleType,
  IStateTreeNode,
  Instance,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'

export type ConfigurationSchemaForModel<MODEL> =
  MODEL extends IStateTreeNode<infer SCHEMA extends AnyConfigurationSchemaType>
    ? SCHEMA
    : never

/**
 * A schema's definition as **stored**: the author's own entries over the ones
 * its `baseConfiguration` contributed, the type-level twin of
 * `mergeSchemaDefinition`. The base arrives already merged with its own base,
 * so one level here covers a chain of any depth.
 *
 * A flat mapped type over the union of both key sets, not
 * `Omit<BASE, keyof D> & D`: an intersection's `keyof` is a union of key sets,
 * and mapping over a union that includes `string` — which
 * `ConfigurationSchemaDefinition`'s index signature contributes — collapses
 * back to an index signature, which is the thing `ConfigNodeProps` exists to
 * get rid of.
 */
export type MergeConfigDef<D, BASE> =
  BASE extends ConfigurationSchemaType<infer BD, any>
    ? {
        [K in keyof BD | keyof D]: NormalizeSlotDef<
          K extends keyof D
            ? K extends keyof BD
              ? MergeSlotDef<BD[K], D[K]>
              : D[K]
            : K extends keyof BD
              ? BD[K]
              : never
        >
      }
    : { [K in keyof D]: NormalizeSlotDef<D[K]> }

/**
 * A redeclared slot merges field-by-field over the base's; a sub-schema or a
 * constant keeps replace semantics, matching `mergeSchemaDefinition`'s
 * `isSlotDefinitionEntry` guard.
 */
type MergeSlotDef<BASE_ENTRY, ENTRY> = BASE_ENTRY extends { type: string }
  ? ENTRY extends { type: string }
    ? Omit<BASE_ENTRY, keyof ENTRY> & ENTRY
    : ENTRY
  : ENTRY

/**
 * What the type level reads off a slot definition: the slot's `type`, a
 * `stringEnum`'s `model`, and whether a `defaultValue` is there at all — widened
 * off its literal. The description, `advanced`, `contextVariable` and the
 * literal default are documentation and runtime, and carrying them makes two
 * schemas that differ only in one of them mutually unassignable: a subclass
 * raising `height` from 100 to 250 stopped satisfying a parameter pinned to its
 * base. `SlotValueRawFromDef` re-widens a scalar default anyway, and reaches
 * `any` for everything else, so nothing downstream loses precision.
 */
type NormalizeSlotDef<E> = E extends AnyConfigurationSchemaType
  ? E
  : E extends { type: infer T }
    ? { type: T } & (E extends { model: infer M } ? { model: M } : unknown) &
        (E extends { defaultValue: infer V }
          ? { defaultValue: WidenDefaultValue<V> }
          : unknown)
    : E

type WidenDefaultValue<V> = [V] extends [boolean]
  ? boolean
  : [V] extends [string]
    ? string
    : [V] extends [number]
      ? number
      : unknown

type ConfigNodeValue<DEF> =
  IsAny<DEF> extends true
    ? any
    : DEF extends AnyConfigurationSchemaType
      ? DEF['Type']
      : DEF extends IArrayType<any>
        ? DEF['Type']
        : DEF extends string
          ? string
          : DEF extends number
            ? number
            : SlotValueRawFromDef<DEF>

/**
 * The slots a config node presents, read off the schema's own DEFINITION rather
 * than the `Record<string, any>` `makeConfigurationSchemaModel` assembles its
 * MST props from. Those props carry an index signature, so every
 * `node.anything` resolves to `any`; mapping the definition instead is what
 * makes `node.colorr` a compile error.
 *
 * A plain mapped type, and it has to stay one. Wrapping it in a conditional —
 * to answer early for a widened definition, say — makes TypeScript measure
 * DEFINITION as covariant instead of invariant, and it refuses a failed
 * covariant check on a type argument outright where a failed invariant one
 * falls back to comparing the two schemas structurally. Structural is the
 * comparison that matters: a subclass schema's node has every slot the base's
 * does, while its *definition* restates `defaultValue` and `description` and so
 * matches nothing. The widened case belongs on `AnyConfigurationModel`.
 */
export type ConfigNodeProps<DEFINITION> = {
  [K in keyof DEFINITION]: ConfigNodeValue<DEFINITION[K]>
}

/**
 * The two write actions every config node carries, which `setConf` is the
 * spelling of. A type alias rather than an interface because it annotates the
 * `.actions` block: MST constrains that to `ModelActions`, an index signature
 * of functions, and only a type alias of an object literal gets the implicit
 * index signature that satisfies it.
 */
export type ConfigNodeActions = {
  setSubschema: (slotName: string, data: unknown) => unknown
  setSlot: (slotName: string, value: unknown) => void
}

/**
 * MST's node brand, restated. A config node carries its own schema here by
 * polymorphic `this`, and `ConfigurationSchemaForModel` walks it back out —
 * which is what every `getConf` / `readConfObject` / `setConf` slot-name
 * constraint hangs off, so losing it switches the read-side check off with no
 * error anywhere. `scripts/audit-config-read-types.ts` is the only thing that
 * reports that; run it after touching this.
 *
 * Structurally identical to `IStateTreeNode<IT>`, but an alias rather than an
 * interface: TypeScript infers an implicit index signature for an intersection
 * only when every constituent is an alias or a mapped type, and that is what
 * leaves a concrete config node — whose props are a mapped type with no index
 * signature of its own — assignable to `AnyConfigurationModel`.
 */
export type ConfigNodeBrand<IT extends IAnyType> = {
  readonly $treenode?: any
  readonly $__mstStateTreeNodeType__?: [IT] | [any]
}

/**
 * The identifier a schema's `explicitIdentifier` installs, folded into the
 * definition as if it were a declared string slot — which is what it is at
 * runtime, `makeConfigurationSchemaModel` just builds it from the options rather
 * than from the table. Folding it in rather than intersecting it onto `Type`
 * keeps it out of `ConfigurationSchemaType`'s parameter list: as a parameter it
 * reads as invariant (it lands in a `Record<K, …>` key position), which stops a
 * concrete schema widening to `AnyConfigurationSchemaType`. Inheritance comes
 * free, since `MergeConfigDef` already folds the base's whole definition in.
 */
export interface IdentifierSlotDef {
  type: 'string'
  defaultValue: ''
}

/**
 * The `type` prop an `explicitlyTyped` schema installs, folded into the
 * definition the same way and for the same reasons. Separate from
 * `IdentifierSlotDef` despite the identical shape, because the runtime prop is
 * `types.literal(modelName)` and this is where that would be said if the model
 * name ever became a type parameter.
 */
export interface TypeSlotDef {
  type: 'string'
  defaultValue: ''
}

export type ConfigurationSlotName<SCHEMA> =
  IsAny<SCHEMA> extends true
    ? string
    : SCHEMA extends ConfigurationSchemaType<infer D, any>
      ? keyof D & string
      : never

/**
 * The names a config snapshot for `SCHEMA` may use — its own slots, its
 * sub-schemas recursively, its identifier and everything it inherits — with
 * every value left `unknown`.
 *
 * Names are the whole point of it. A slot value can be its own type, a `jexl:`
 * callback string, or (for a `maybe*` slot) absent, and nothing here tries to
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
      }
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
  stringMap: Record<string, string>
  fileLocation: FileLocation
  maybeFileLocation: FileLocation | undefined
  maybeNumber: number | undefined
  maybeBoolean: boolean | undefined
  maybeColor: string | undefined
  maybeString: string | undefined
  /**
   * `frozen` and its `maybe*` form are `any` deliberately — arbitrary dynamic
   * JSON whose shape the caller asserts at the read boundary. `unknown` would
   * only add cast ceremony on values that are legitimately dynamic.
   *
   * Stated here rather than left to the `defaultValue` fallback, which reaches
   * `any` for these only by accident: no `frozen` slot in the repo happens to
   * default to a scalar.
   */
  frozen: any
  maybeFrozen: any
  number: number
  integer: number
  boolean: boolean
  string: string
  text: string
  featureField: string
  color: string
  colorArray: string[]
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
    ? // an enum slot declares the plain enumeration as its `model` and gets
      // its shape from ConfigSlot, so the `undefined` or the list is added
      // back here
      DEF extends { type: 'maybeStringEnum' }
      ? T | undefined
      : DEF extends { type: 'stringEnumArray' }
        ? T[]
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

// A widened schema reaches the second segment as bare `any` — the first one
// answered `D[K]` off an `any` definition — and `any` matches the pattern below
// through its false arm. So without the `IsAny` arm the walk answers `never`
// from two segments on, where one segment answers `any`, and a `never` read
// satisfies whatever the caller annotates while refusing every member read.
type SubSchemaOf<SCHEMA, K> =
  IsAny<SCHEMA> extends true
    ? any
    : SCHEMA extends ConfigurationSchemaType<infer D, any>
      ? K extends keyof D
        ? D[K]
        : never
      : never

type SubSchemaSlotPath<SCHEMA> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? IsAny<D> extends true
      ? readonly string[]
      : {
          [K in keyof D & string]: D[K] extends AnyConfigurationSchemaType
            ?
                | readonly [K, ConfigurationSlotName<D[K]>]
                | readonly [K, ...SubSchemaSlotPath<D[K]>]
            : D[K] extends IAnyType | { type: 'frozen' | 'maybeFrozen' }
              ? readonly [K, ...string[]]
              : never
        }[keyof D & string]
    : readonly string[]

/**
 * The array paths a read may take into `SCHEMA`. Past one segment each is
 * checked: a sub-schema's name, then one of its slot names or a deeper path. A
 * head naming something other than a sub-schema — a pluggable adapter union, an
 * array or map of sub-schemas, a `frozen` slot — keeps an unchecked tail, and a
 * widened schema admits any `string[]`.
 *
 * A one-segment path stays unchecked: it is how a generic class body, where
 * `SCHEMA` is unresolved, reads a slot at all (`FastaAdapterBase`).
 */
export type ConfigurationSlotPath<SCHEMA> =
  | readonly []
  | readonly [string]
  | SubSchemaSlotPath<SCHEMA>

/** what a read of `PATH` into `SCHEMA` yields */
export type ConfigurationSlotPathValue<SCHEMA, PATH> = PATH extends readonly [
  infer HEAD,
  ...infer REST,
]
  ? SubSchemaOf<SCHEMA, HEAD> extends infer SUB extends
      AnyConfigurationSchemaType
    ? REST extends readonly [infer SLOT extends string]
      ? ConfigurationSlotValue<SUB, SLOT>
      : ConfigurationSlotPathValue<SUB, REST>
    : any
  : any

/** what a raw read (`getConf` / `readConfObject`) of this slot yields */
export type ConfigurationSlotValue<SCHEMA, K extends string> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? K extends keyof D
      ? SlotValueRawFromDef<D[K]>
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
export type AnyConfigurationModel = Instance<AnyConfigurationSchemaType> &
  // A schema widened to `AnyConfigurationSchemaType` has no slot table to map,
  // so its node's props would read as nothing at all. The index signature is
  // here rather than in `ConfigNodeProps`, where an `IsAny` branch would leave
  // the props a deferred conditional and cost `DEFINITION` its covariance.
  Record<string, any>

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
  ConfigurationSchemaType<
    MergeConfigDef<FIELDS, BASE>,
    ConfigurationSchemaOptions<BASE, undefined>
  >
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
 * cast to `AnyConfigurationModel` compiles and runs and checks nothing. Every
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
 * plain snapshot of one. `session.tracks` holds plain base or merged configs
 * that hydrate to MST only on first reference access, `getTrackById` also
 * answers live assembly-sequence and connection nodes, and `readConfObject`
 * reads both — so this is the honest type at those boundaries. Reserve
 * `AnyConfigurationModel` for values that must be live (actions, identity,
 * reference resolution).
 */
export type AnyConfiguration = AnyConfigurationModel | AnyConfigurationSnapshot
