import {
  getEnv,
  isArrayType,
  isMapType,
  isOptionalType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import { isObservableArray } from 'mobx'

import { getContainingTrack, getSession } from '../util/mstUtils.ts'
import { isSessionWithEditableTrackConfig } from '../util/types/index.ts'
import ConfigSlot, { slotWriteRefusal } from './configurationSlot.ts'
import { checkRequirements } from './requirements.ts'
import {
  getConfigurationSchemaMetadata,
  registerConfigurationSchema,
} from './schemaRegistry.ts'
import {
  isConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
  shorthandTargetsOf,
} from './schemaTypes.ts'
import {
  preProcessSnapshotWith,
  refusingUndeclaredKeys,
} from './snapshotPreprocess.ts'

import type PluginManager from '../PluginManager.ts'
import type { IsAny } from '../util/types/isAny.ts'
import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { ConfigurationSchemaRequirement } from './requirements.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigNodeActions,
  ConfigNodeBrand,
  ConfigNodeProps,
  IdentifierSlotDef,
  MergeConfigDef,
  TypeSlotDef,
} from './types.ts'
import type {
  IAnyType,
  ISimpleType,
  IType,
  ReferenceIdentifier,
  SnapshotIn,
  SnapshotOut,
} from '@jbrowse/mobx-state-tree'
import type { IObservableArray } from 'mobx'

export type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from './types.ts'

/**
 * Each entry is a slot definition, a constant (bare string/number), or a
 * sub-schema: the MST type `ConfigurationSchema()` returned.
 */
export interface ConfigurationSchemaDefinition {
  [n: string]: ConfigSlotDefinition | string | number | IAnyType
}

export type RetiredSpelling = (value: unknown) => Record<string, unknown>

export interface ConfigurationSchemaOptions<
  BASE_SCHEMA extends AnyConfigurationSchemaType | undefined,
  EXPLICIT_IDENTIFIER extends string | undefined,
  EXPLICITLY_TYPED extends boolean | undefined = boolean | undefined,
  REQUIREMENT extends ConfigurationSchemaRequirement =
    ConfigurationSchemaRequirement,
  // the node a hook is handed, filled in from the definition
  SELF = any,
> {
  explicitlyTyped?: EXPLICITLY_TYPED
  explicitIdentifier?: EXPLICIT_IDENTIFIER
  baseConfiguration?: BASE_SCHEMA

  actions?: (self: SELF) => any
  views?: (self: SELF) => any
  extend?: (self: SELF) => any
  /**
   * The slot a bare string or number snapshot lifts into, as that slot's type
   * takes it, so `color: "red"` and `color: { value: "red" }` are one config,
   * and `rules: [5]` is `rules: [{ value: 5 }]`; or two slots, one taking a
   * number and one a string, so a width's `size: 3` is `{ value: 3 }` and
   * `size: "score"` is `{ field: "score" }`. Applied before
   * `preProcessSnapshot`, on every path a snapshot arrives by; the JSON schema,
   * `describeSlots` and the config editor read it here.
   */
  shorthand?: string | readonly string[]
  /**
   * Slots a bare value sets beside `shorthand`, for a schema whose defaults
   * would hide it: LGVSyntenyColor's `field` defaults to `strand`, so its
   * `color: "steelblue"` is `{ value: "steelblue", scale: "none" }`.
   */
  shorthandWith?: Record<string, unknown>
  /**
   * What a snapshot key the schema does not declare meets, where MST would
   * drop it in silence: a config loading names the key on the console and
   * loads without it, so a config written for another version still draws,
   * and a write (`refusingUndeclaredKeys`) refuses it. Checked after the
   * `shorthand` lift and the schema's own `preProcessSnapshot`, on the same
   * paths, and only on the schema's own snapshot where a union runs every
   * member over an entry. A display, the `explicitlyTyped` schema identified
   * by `displayId`, is closed unless it says `false`.
   */
  closed?: boolean
  /**
   * The spellings an older release used, by the name it used, each answering
   * the members that name's value becomes. Lifted
   * before the `closed` check and `preProcessSnapshot`, on every path a
   * snapshot or a settings bag arrives by, and read by the `displayDefaults`
   * router, so one declaration serves a config entry, the shorthand object, a
   * share link and an agent's bag alike. A spelling the snapshot already
   * carries wins over the one a lift produces, and a name the schema declares
   * is left alone, so a subclass keeping a slot its base retired still takes
   * it. A lift reading no value and answering no member (`() => ({})`) drops
   * the key, which `jbrowse validate` reports as never read.
   */
  retired?: Record<string, RetiredSpelling>
  /**
   * A color object's defaults by `field`, `*` for any other: the scale while
   * `scale` is unset, and the members that scale reads while unwritten.
   */
  fieldPresets?: Readonly<Record<string, { readonly scale: string }>>
  /**
   * The field a color object naming neither a field nor a constant maps
   * (`withImpliedField`).
   */
  impliedField?: string
  preProcessSnapshot?: (
    snapshot: Record<string, unknown>,
  ) => Record<string, unknown>
  requires?: REQUIREMENT[]
}

type SchemaHook = (self: any) => any

/**
 * Options as stored, with a `baseConfiguration`'s hooks merged in. `actions`,
 * `views` and `extend` stay a chain that MST applies one call per entry, which
 * puts the base's members on `self` before the subclass's function runs and
 * lets the subclass override one by name; a spread merge would give neither,
 * and would drop half of `extend`'s `{actions, views, state}`.
 * `preProcessSnapshot` composes into one function, `child(base(snapshot))`,
 * since `preProcessSnapshotWith` runs it off the registry.
 */
export interface MergedConfigurationSchemaOptions<
  BASE_SCHEMA extends AnyConfigurationSchemaType | undefined,
  EXPLICIT_IDENTIFIER extends string | undefined,
> extends Omit<
  ConfigurationSchemaOptions<BASE_SCHEMA, EXPLICIT_IDENTIFIER>,
  'actions' | 'views' | 'extend'
> {
  actions?: SchemaHook | SchemaHook[]
  views?: SchemaHook | SchemaHook[]
  extend?: SchemaHook | SchemaHook[]
}

function hookList(hook: SchemaHook | SchemaHook[] | undefined) {
  return hook === undefined ? [] : Array.isArray(hook) ? hook : [hook]
}

function chainHooks(
  base: SchemaHook | SchemaHook[] | undefined,
  child: SchemaHook | SchemaHook[] | undefined,
) {
  return base && child
    ? [...hookList(base), ...hookList(child)]
    : (child ?? base)
}

// A redeclared slot merges field-by-field over the base's, so an override states
// only what differs; a sub-schema or a constant is replaced whole.
function mergeSchemaDefinition(
  baseDefinition: ConfigurationSchemaDefinition,
  childDefinition: ConfigurationSchemaDefinition,
): ConfigurationSchemaDefinition {
  const merged: ConfigurationSchemaDefinition = {
    ...baseDefinition,
    ...childDefinition,
  }
  for (const [slot, childEntry] of Object.entries(childDefinition)) {
    const baseEntry = baseDefinition[slot]
    if (isSlotDefinitionEntry(baseEntry) && isSlotDefinitionEntry(childEntry)) {
      merged[slot] = { ...baseEntry, ...childEntry }
    }
  }
  return merged
}

// No two slots a shorthand names take the same bare form, since a bare value
// lifts by its form alone. A name may be a key `preProcessSnapshot` expands
// rather than a slot, as an assembly sidecar's `uri` is.
function checkShorthand(
  modelName: string,
  definition: ConfigurationSchemaDefinition,
  shorthand: string | readonly string[] | undefined,
) {
  const slots =
    shorthand === undefined
      ? []
      : typeof shorthand === 'string'
        ? [shorthand]
        : shorthand
  if (
    Object.keys(shorthandTargetsOf(definition, shorthand)).length < slots.length
  ) {
    throw new Error(
      `${modelName}'s shorthand names ${slots.join(' and ')}, which take the same bare form, so a bare value could not say which it means`,
    )
  }
}

function preprocessConfigurationSchemaArguments(
  modelName: string,
  inputSchemaDefinition: ConfigurationSchemaDefinition,
  inputOptions: ConfigurationSchemaOptions<any, any> = {},
) {
  if (typeof modelName !== 'string') {
    throw new Error(
      'first arg must be string name of the model that this config schema goes with',
    )
  }

  let schemaDefinition = inputSchemaDefinition
  let options: MergedConfigurationSchemaOptions<any, any> = inputOptions
  const baseMeta = inputOptions.baseConfiguration
    ? getConfigurationSchemaMetadata(inputOptions.baseConfiguration)
    : undefined
  if (inputOptions.baseConfiguration && !baseMeta) {
    throw new Error(
      `${modelName}'s baseConfiguration is not a configuration schema: it has no registered slot table, so every slot it was meant to inherit would be dropped silently. Pass the type ConfigurationSchema() returned, not a union (pluginManager.pluggableConfigSchemaType) or a plain MST model.`,
    )
  }
  if (baseMeta) {
    schemaDefinition = mergeSchemaDefinition(
      baseMeta.definition,
      schemaDefinition,
    )
    // The hooks, `requires` and `retired` compose, base first, where every
    // other option is replaced by the child's: a track schema's own
    // preProcessSnapshot must not drop the base's display-stub injection.
    const basePreProcess = baseMeta.options.preProcessSnapshot
    const childPreProcess = inputOptions.preProcessSnapshot
    const requires = [
      ...(baseMeta.options.requires ?? []),
      ...(inputOptions.requires ?? []),
    ]
    options = {
      ...baseMeta.options,
      ...inputOptions,
      baseConfiguration: undefined,
      actions: chainHooks(baseMeta.options.actions, inputOptions.actions),
      views: chainHooks(baseMeta.options.views, inputOptions.views),
      extend: chainHooks(baseMeta.options.extend, inputOptions.extend),
      preProcessSnapshot:
        basePreProcess && childPreProcess
          ? snapshot => childPreProcess(basePreProcess(snapshot))
          : (childPreProcess ?? basePreProcess),
      retired:
        baseMeta.options.retired || inputOptions.retired
          ? { ...baseMeta.options.retired, ...inputOptions.retired }
          : undefined,
      requires: requires.length ? requires : undefined,
    }
  }
  if (options.explicitlyTyped && options.explicitIdentifier === 'displayId') {
    options = { ...options, closed: options.closed ?? true }
  }
  return { schemaDefinition, options }
}

function makeConfigurationSchemaModel<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends MergedConfigurationSchemaOptions<any, any>,
>(modelName: string, schemaDefinition: DEFINITION, options: OPTIONS) {
  const modelDefinition: Record<string, any> = {}
  if (options.explicitlyTyped) {
    modelDefinition.type = types.optional(types.literal(modelName), modelName)
  }

  const identifier = options.explicitIdentifier
  if (identifier) {
    modelDefinition[identifier] = types.identifier
  }

  const volatileConstants: Record<string, unknown> = {}
  const subSchemaKeys = new Set<string>()
  const collectionKeys = new Set<string>()
  // narrower than `modelDefinition`, which also holds the identifier and the
  // sub-schemas, neither of which setSlot may write
  const slotKeys = new Set<string>()
  const featureFields = new Set<string>()
  const takesNoCallback = new Map<string, string>()
  for (const [slotName, slotDefinition] of Object.entries(schemaDefinition)) {
    if (isConfigurationSchemaType(slotDefinition)) {
      // an empty collection strips from the snapshot as an all-default
      // sub-schema does, unless it names a default of its own
      if (isArrayType(slotDefinition) || isMapType(slotDefinition)) {
        modelDefinition[slotName] = isOptionalType(slotDefinition)
          ? slotDefinition
          : types.stripDefault(
              slotDefinition,
              isArrayType(slotDefinition) ? [] : {},
            )
        collectionKeys.add(slotName)
      } else {
        modelDefinition[slotName] = slotDefinition
        subSchemaKeys.add(slotName)
      }
    } else if (isConstantEntry(slotDefinition)) {
      volatileConstants[slotName] = slotDefinition
    } else if (isSlotDefinitionEntry(slotDefinition)) {
      slotKeys.add(slotName)
      try {
        modelDefinition[slotName] = ConfigSlot(slotDefinition)
        if (slotDefinition.type === 'featureField') {
          featureFields.add(slotName)
        } else if (!slotDefinition.contextVariable?.length) {
          takesNoCallback.set(slotName, slotDefinition.type)
        }
      } catch (e) {
        throw new Error(
          `invalid config slot definition for ${modelName}.${slotName}: ${e}`,
          { cause: e },
        )
      }
    } else if (typeof slotDefinition === 'object') {
      throw new Error(`no type set for config slot ${modelName}.${slotName}`)
    } else {
      throw new Error(
        `invalid configuration schema definition, "${slotName}" must be either a valid configuration slot definition, a constant, or a nested configuration schema`,
      )
    }
  }
  checkRequirements(modelName, schemaDefinition, options.requires ?? [])
  checkShorthand(modelName, schemaDefinition, options.shorthand)

  let completeModel = types
    .model(`${modelName}ConfigurationSchema`, modelDefinition)
    // annotated so `ConfigurationSchemaType['Type']`, which names these by
    // hand, cannot drift from them
    .actions((self): ConfigNodeActions => ({
      // `data` is whatever the sub-schema's preProcessSnapshot takes; a
      // collection takes the whole list or map, and `null` resets it
      setSubschema(slotName: string, data: unknown) {
        if (collectionKeys.has(slotName)) {
          // checked on a copy, since the assignment runs patch listeners
          if (data != null && !isStateTreeNode(data)) {
            refusingUndeclaredKeys(() => modelDefinition[slotName].create(data))
          }
          self[slotName] = data ?? undefined
          return self[slotName]
        }
        if (!subSchemaKeys.has(slotName)) {
          throw new Error(`${slotName} is not a subschema, cannot replace`)
        }
        const newSchema = isStateTreeNode(data)
          ? data
          : refusingUndeclaredKeys(() => modelDefinition[slotName].create(data))
        self[slotName] = newSchema
        return newSchema
      },
      // The name check is a write guard (ADR-052), never a warning. `null`
      // resets, as `undefined` does, since JSON cannot spell `undefined`
      // (ADR-146).
      setSlot(slotName: string, rawValue: unknown) {
        const value = rawValue ?? undefined
        if (!slotKeys.has(slotName)) {
          throw new Error(
            isConfigurationSchemaType(schemaDefinition[slotName])
              ? `${slotName} is a sub-schema on ${modelName}, not a config slot — replace it with setSubschema`
              : `${modelName} has no config slot "${slotName}". Valid slots: ${[
                  ...slotKeys,
                ]
                  .sort()
                  .join(', ')}`,
          )
        }
        // MST skips its own type check in a production build; `is` does not
        if (!modelDefinition[slotName].is(value)) {
          const declared = schemaDefinition[slotName]
          const slotType = isSlotDefinitionEntry(declared)
            ? declared.type
            : 'value'
          throw new Error(
            slotWriteRefusal(`${modelName}.${slotName}`, slotType, value),
          )
        }
        const held: unknown = self[slotName]
        if (isObservableArray(held) && Array.isArray(value)) {
          refillArray(held, value)
        } else {
          self[slotName] = value
        }
      },
    }))

  if (Object.keys(volatileConstants).length) {
    completeModel = completeModel.volatile((/* self */) => volatileConstants)
  }
  for (const hook of hookList(options.actions)) {
    completeModel = completeModel.actions(hook)
  }
  for (const hook of hookList(options.views)) {
    completeModel = completeModel.views(hook)
  }
  for (const hook of hookList(options.extend)) {
    completeModel = completeModel.extend(hook)
  }
  const metadata = {
    name: modelName,
    definition: schemaDefinition,
    options,
    featureFields,
    takesNoCallback,
  }
  completeModel = completeModel.preProcessSnapshot(snapshot =>
    preProcessSnapshotWith(metadata, snapshot),
  )

  const identifierDefault = identifier ? { [identifier]: 'placeholderId' } : {}
  const modelDefault = options.explicitlyTyped
    ? { type: modelName, ...identifierDefault }
    : identifierDefault

  // stripDefault, not optional, so an all-default sub-schema leaves its
  // parent's snapshot
  registerConfigurationSchema(completeModel, metadata)
  return types.stripDefault(completeModel, modelDefault)
}

/**
 * DEFINITION is unconstrained: a constraint would put an index signature back
 * into `keyof DEFINITION`. `ConfigurationSchema`'s own parameter checks the
 * literal where it arrives. ADR-145.
 */
export interface ConfigurationSchemaType<
  // `out`, or a factory pinned to a base schema refuses its subclasses
  out DEFINITION,
  OPTIONS extends ConfigurationSchemaOptions<any, any>,
> extends ReturnType<
  typeof makeConfigurationSchemaModel<
    DEFINITION & ConfigurationSchemaDefinition,
    OPTIONS
  >
> {
  /**
   * Replaces the factory's `Record<string, any>` props with the definition's,
   * and brands the node with this schema for `ConfigurationSchemaForModel`.
   * `TypeWithoutSTN` is what a `types.optional` or `stripDefault` wrapper builds
   * its instance from.
   */
  readonly Type: ConfigNodeProps<DEFINITION> &
    ConfigNodeActions &
    ConfigNodeBrand<this>
  readonly TypeWithoutSTN: ConfigNodeProps<DEFINITION> & ConfigNodeActions
}

type RequirementPath<D> = {
  [K in keyof D & string]:
    | K
    | (D[K] extends ConfigurationSchemaType<infer SUB, any>
        ? `${K}.${RequirementPath<SUB>}`
        : never)
}[keyof D & string]

type RequirementWhen<D> = {
  [
    K in keyof D & string as D[K] extends { type: string } ? K : never
  ]?: (D[K] extends { model: ISimpleType<infer V extends string> }
    ? V
    : string)[]
}

type RequirementOf<D, BASE> =
  BASE extends ConfigurationSchemaType<infer BD, any>
    ? ConfigurationSchemaRequirement<
        RequirementWhen<D> & RequirementWhen<BD>,
        RequirementPath<D> | RequirementPath<BD>
      >
    : ConfigurationSchemaRequirement<RequirementWhen<D>, RequirementPath<D>>

// Assigning an array makes MST reconcile it entry by entry, seconds for a
// reorder of 5,000 row names; refilling a scalar array takes 50 ms.
// spliceWithArray, since spreading into `push` overflows the stack past about
// 120,000 entries.
function refillArray(held: IObservableArray<unknown>, value: unknown[]) {
  if (held.length !== value.length || held.some((v, i) => v !== value[i])) {
    held.clear()
    held.spliceWithArray(0, 0, value)
  }
}

export function ConfigurationSchema<
  // `const` keeps each slot's literal `type`, which the read types key on
  const DEFINITION extends ConfigurationSchemaDefinition,
  BASE_SCHEMA extends AnyConfigurationSchemaType | undefined = undefined,
  EXPLICIT_IDENTIFIER extends string | undefined = undefined,
  EXPLICITLY_TYPED extends boolean | undefined = undefined,
>(
  modelName: string,
  inputSchemaDefinition: DEFINITION,
  inputOptions?: ConfigurationSchemaOptions<
    BASE_SCHEMA,
    EXPLICIT_IDENTIFIER,
    EXPLICITLY_TYPED,
    RequirementOf<NoInfer<DEFINITION>, NoInfer<BASE_SCHEMA>>,
    ConfigNodeProps<MergeConfigDef<NoInfer<DEFINITION>, NoInfer<BASE_SCHEMA>>> &
      ConfigNodeActions
  >,
): ConfigurationSchemaType<
  MergeConfigDef<
    DEFINITION &
      Record<EXPLICIT_IDENTIFIER & string, IdentifierSlotDef> &
      (EXPLICITLY_TYPED extends true ? { type: TypeSlotDef } : unknown),
    BASE_SCHEMA
  >,
  ConfigurationSchemaOptions<BASE_SCHEMA, EXPLICIT_IDENTIFIER, EXPLICITLY_TYPED>
> {
  const { schemaDefinition, options } = preprocessConfigurationSchemaArguments(
    modelName,
    inputSchemaDefinition,
    inputOptions,
  )
  return makeConfigurationSchemaModel(
    modelName,
    schemaDefinition,
    options,
  ) as AnyConfigurationSchemaType
}

// memoized per PluginManager, so a node never crosses to another instance's env
// (ADR-031)
function hydrateInto(
  pluginManager: PluginManager,
  schemaType: IAnyType,
  frozen: object,
) {
  return pluginManager.hydratedTrackConfig(schemaType, frozen, () =>
    schemaType.create(frozen, { pluginManager }),
  )
}

/**
 * #api core/configuration
 * Hydrate a plain track config, such as a `session.tracks` entry, into a live
 * config node, dispatching on its `type` to find the schema. A plain entry
 * holds only what was authored: a slot at its default is absent and
 * `preProcessSnapshot` has not run.
 *
 * Returns **undefined** when no plugin registered the type or `create` rejects
 * the config, which has never been validated; callers fall back to the plain
 * object. Hydrating one entry twice returns one node. A shown track resolves to
 * the session's working copy instead (ADR-032), which has the same content.
 */
export function hydrateTrackConfig(
  pluginManager: PluginManager,
  config: Record<string, unknown>,
): AnyConfigurationModel | undefined {
  const type = config.type
  if (typeof type !== 'string') {
    return undefined
  }
  try {
    const { configSchema } = pluginManager.getTrackType(type)
    return hydrateInto(
      pluginManager,
      configSchema,
      config,
    ) as AnyConfigurationModel
  } catch (e) {
    console.error(e)
    return undefined
  }
}

// An id string resolves through `ref`; an object is an inline config. So
// assigning a node here adopts it as a child rather than storing a reference,
// which makes both refs' `set` unreachable: MST only requires one beside `get`.
function idOrSnapshotUnion(ref: IAnyType, schemaType: IAnyType) {
  return types.union(
    {
      dispatcher: snapshot => (typeof snapshot === 'string' ? ref : schemaType),
    },
    ref,
    schemaType,
  )
}

/**
 * Reference to a track configuration, snapshotted as its trackId. It also takes
 * a whole config: a view's synthesized track (a read-vs-ref band, an SV
 * inspector row) holds its config inline and lives and dies with it. ADR-084.
 */
function TrackConfigurationReference(schemaType: IAnyType) {
  const trackRef = types.reference(schemaType, {
    get(id, parent) {
      const session = getSession(parent)
      const trackId = String(id)
      const ret = isSessionWithEditableTrackConfig(session)
        ? session.getEditableTrackConfig(trackId, schemaType)
        : session.getTrackById(trackId)
      if (!ret) {
        throw new Error(`Could not resolve trackId "${id}"`)
      }
      return isStateTreeNode(ret)
        ? ret
        : hydrateInto(
            getEnv<{ pluginManager: PluginManager }>(parent).pluginManager,
            schemaType,
            ret,
          )
    },
    set(value) {
      return value.trackId
    },
  })

  return idOrSnapshotUnion(trackRef, schemaType)
}

/**
 * Reference to a display configuration in the containing track config's
 * `displays`, snapshotted as its displayId. An id that matches nothing falls
 * back to the display of the parent's type, which the track config always
 * holds a stub of: that is what reconnects a session saved before a display
 * type was renamed.
 */
function DisplayConfigurationReference(schemaType: IAnyType) {
  const displayRef = types.reference(schemaType, {
    get(id, parent) {
      const track = getContainingTrack(parent)
      const displays: AnyConfigurationModel[] = track.configuration.displays
      const displayType = (parent as { type?: string }).type
      let ret = displays.find(d => d.displayId === id)
      if (!ret && displayType) {
        ret = displays.find(d => d.type === displayType)
      }

      if (!ret) {
        const trackId = (track.configuration as { trackId?: string }).trackId
        throw new Error(
          `Display configuration "${id}" not found on track "${trackId}" (looked up by displayId, then by type "${displayType ?? '<no type on parent>'}")`,
        )
      }
      return ret
    },
    set(value) {
      return value.displayId
    },
  })

  return idOrSnapshotUnion(displayRef, schemaType)
}

// a concrete schema's single-branded instance, so reads narrow; `any` for a
// widened schema
type ConfigReferenceInstance<SCHEMA extends AnyConfigurationSchemaType> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? IsAny<D> extends true
      ? any
      : SCHEMA['Type']
    : SCHEMA['Type']

/**
 * The type of a track or display model's `configuration` prop: snapshots are
 * `id | config`, as the runtime union takes, and the instance carries the
 * concrete schema so `getConf(self, slot)` narrows. `Type` is re-added rather
 * than taken from `IType`, whose `STNValue` would brand the node a second time
 * and leave `ConfigurationSchemaForModel` inferring `any`.
 */
export type IConfigurationReference<SCHEMA extends AnyConfigurationSchemaType> =
  Omit<
    IType<
      ReferenceIdentifier | SnapshotIn<SCHEMA>,
      ReferenceIdentifier | SnapshotOut<SCHEMA>,
      ConfigReferenceInstance<SCHEMA>
    >,
    'Type'
  > & { readonly Type: ConfigReferenceInstance<SCHEMA> }

/**
 * A reference resolved by the schema's identifier: a `trackId` through the
 * session, a `displayId` through the containing track's `displays`, anything
 * else by MST's own identifier lookup. No `as SCHEMATYPE` on the return: it
 * would narrow `SnapshotIn` to the object branch and refuse a string id.
 */
export function ConfigurationReference<
  SCHEMATYPE extends AnyConfigurationSchemaType,
>(schemaType: SCHEMATYPE): IConfigurationReference<SCHEMATYPE> {
  const id =
    getConfigurationSchemaMetadata(schemaType)?.options.explicitIdentifier
  const ref =
    id === 'trackId'
      ? TrackConfigurationReference(schemaType)
      : id === 'displayId'
        ? DisplayConfigurationReference(schemaType)
        : // not idOrSnapshotUnion: this branch is handed live in-tree nodes
          // (an internet account), which its dispatcher would try to adopt
          types.union(types.reference(schemaType), schemaType)
  return ref
}
