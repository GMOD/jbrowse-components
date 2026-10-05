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
  IOptionalIType,
  ISimpleType,
  IStateTreeNode,
  Instance,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'

// A config node under `types.optional` or `types.stripDefault` brands the
// wrapper, so the schema is unwrapped from it, after the concrete arm: the
// brand's `[any]` member would match an unwrap tried first.
export type ConfigurationSchemaForModel<MODEL> =
  IsAny<MODEL> extends true
    ? AnyConfigurationSchemaType
    : MODEL extends IStateTreeNode<infer T>
      ? T extends AnyConfigurationSchemaType
        ? T
        : T extends IOptionalIType<
              infer INNER extends AnyConfigurationSchemaType,
              any
            >
          ? INNER
          : AnyConfigurationSchemaType
      : never

/**
 * A schema's definition over its `baseConfiguration`'s, the type-level twin of
 * `mergeSchemaDefinition`. A flat mapped type rather than
 * `Omit<BASE, keyof D> & D`, which states it less clearly. ADR-145.
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

type MergeSlotDef<BASE_ENTRY, ENTRY> = BASE_ENTRY extends { type: string }
  ? ENTRY extends { type: string }
    ? Omit<BASE_ENTRY, keyof ENTRY> & ENTRY
    : ENTRY
  : ENTRY

/**
 * Only `type`, `model` and a widened `defaultValue`: carrying a description or
 * a literal default makes a subclass that changes one unassignable to its base.
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
      : DEF extends IArrayType<any> | IOptionalIType<IArrayType<any>, any>
        ? DEF['Type']
        : DEF extends string
          ? string
          : DEF extends number
            ? number
            : SlotValueRawFromDef<DEF>

/**
 * A config node's slots, off the schema's definition, so `node.colorr` is a
 * compile error (ADR-145). It must stay a plain mapped type: a conditional
 * wrapper makes TypeScript refuse a subclass schema where the base is expected
 * instead of comparing the two structurally.
 */
export type ConfigNodeProps<DEFINITION> = {
  [K in keyof DEFINITION]: ConfigNodeValue<DEFINITION[K]>
}

/**
 * The two write actions under `setConf`. An alias, not an interface: only an
 * alias gets the implicit index signature MST's `ModelActions` requires.
 */
export type ConfigNodeActions = {
  setSubschema: (slotName: string, data: unknown) => unknown
  setSlot: (slotName: string, value: unknown) => void
}

/**
 * MST's node brand restated as an alias, which keeps a concrete node assignable
 * to `AnyConfigurationModel`. It carries the schema by polymorphic `this`, and
 * every slot-name check hangs off `ConfigurationSchemaForModel` walking it back
 * out: run `scripts/audit-config-read-types.ts` after touching it.
 */
export type ConfigNodeBrand<IT extends IAnyType> = {
  readonly $treenode?: any
  readonly $__mstStateTreeNodeType__?: [IT] | [any]
}

/**
 * The `explicitIdentifier` prop, folded into the definition as a string slot
 * rather than a type parameter, which would read as invariant and stop a
 * concrete schema widening to `AnyConfigurationSchemaType`.
 */
export interface IdentifierSlotDef {
  type: 'string'
  defaultValue: ''
}

/** An `explicitlyTyped` schema's `type` prop, folded in the same way. */
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
 * The names a config snapshot for `SCHEMA` may use, sub-schemas included, with
 * every value `unknown`. MST drops an undeclared name silently; against an
 * object literal, the excess-property check makes it a compile error.
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

/**
 * What each builtin slot type reads as, beside `slotTypes` in
 * `configurationSlot.ts`. The enum types read their members off `model`.
 */
interface SlotValueByType {
  stringArray: string[]
  expressionArray: string[]
  stringArrayMap: Record<string, string[]>
  numberMap: Record<string, number>
  stringMap: Record<string, string>
  fileLocation: FileLocation
  maybeFileLocation: FileLocation | undefined
  maybeNumber: number | undefined
  maybeBoolean: boolean | undefined
  maybeColor: string | undefined
  maybeString: string | undefined
  /** arbitrary JSON, whose shape the caller asserts where it reads it */
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

// the two tables name the same types, or a new one silently reads as `any`
type MutuallyExtends<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
type Assert<T extends true> = T
export type SlotValueTableCoversBuiltinSlotTypes = Assert<
  MutuallyExtends<BuiltinSlotTypeName, keyof SlotValueByType>
>

// A sub-schema reads as its snapshot, typed so it can't be fed back into
// readConfObject. An enum's shape comes from ConfigSlot, so its `undefined` or
// list is added back here.
type SlotValueRawFromDef<DEF> = DEF extends AnyConfigurationSchemaType
  ? AnyConfigurationSnapshot
  : DEF extends {
        model: ISimpleType<infer T extends string>
      }
    ? DEF extends { type: 'maybeStringEnum' }
      ? T | undefined
      : DEF extends { type: 'stringEnumArray' }
        ? T[]
        : T
    : DEF extends { type: infer T extends keyof SlotValueByType }
      ? SlotValueByType[T]
      : // only a `type` the table doesn't name, such as one widened to
        // `string` by a schema not inferred `const`
        DEF extends { defaultValue: infer V }
        ? [V] extends [boolean]
          ? boolean
          : [V] extends [string]
            ? string
            : [V] extends [number]
              ? number
              : any
        : any

// Without the IsAny arm a widened schema's path walk answers `never` from two
// segments on, which satisfies any annotation and refuses every member read.
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
 * The array paths a read may take into `SCHEMA`, checked segment by segment
 * through sub-schemas. A pluggable union, a collection or a `frozen` slot keeps
 * an unchecked tail. A one-segment path stays unchecked, since a generic class
 * body with `SCHEMA` unresolved reads a slot that way (`FastaAdapterBase`).
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
 * Naming: `XConfigSchema` is the schema (an MST type), for factory params and
 * `ConfigurationReference`; `XConfigModel` is `Instance<XConfigSchema>`, a node.
 */
export type AnyConfigurationSchemaType = ConfigurationSchemaType<any, any>
export type AnyConfigurationModel = Instance<AnyConfigurationSchemaType> &
  // the index signature lives here, since one in ConfigNodeProps would cost
  // DEFINITION its covariance
  Record<string, any>

/**
 * A node of a pluggable element union — a track's, a display's, an adapter's —
 * whichever member it is, naming its `type`. An interface rather than an
 * intersection so a generated doc prints the name.
 */
export interface PluggableConfigNode extends AnyConfigurationModel {
  type: string
}

/**
 * The node type for a mixin's field table (a `*ConfigSchemaFields` export), for
 * the cast a mixin uses to reach its host's `configuration`. A cast to
 * `AnyConfigurationModel` there checks no slot name, so a misspelled read
 * returns `undefined` silently. `BASE` admits the slots of the schema the
 * mixin's displays inherit (`HeightModeMixin`'s `height`).
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
 * The widened form has no symptom: a host cast to `AnyConfigurationModel`
 * compiles, runs and checks nothing.
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
 * plain snapshot of one, such as a config a caller hands to an add action.
 * Reserve `AnyConfigurationModel` for values that must be live (actions,
 * identity, reference resolution).
 */
export type AnyConfiguration = AnyConfigurationModel | AnyConfigurationSnapshot

/**
 * A track config as `jbrowse.tracks` and `session.tracks` hold it: a frozen
 * plain object, which hydrates to a config node only when a track reads its
 * `configuration`. It holds what was written, so a slot at its default is
 * absent. `readConfObject` refuses one for that reason; read `trackId` and
 * `type` off it directly, and a slot through a helper that supplies the
 * default, such as `getConfAssemblyNamesOrNone`.
 */
export interface TrackConfigEntry {
  trackId: string
  type: string
  [key: string]: unknown
}

/**
 * What `getTrackById` answers: a {@link TrackConfigEntry}, or a live node for
 * an assembly's sequence track or a track a connection holds. A raw member
 * read works on both, and finds a slot at its default only on the node.
 */
export type AnyTrackConfig = TrackConfigEntry | AnyConfigurationModel
