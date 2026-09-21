import {
  getEnv,
  isArrayType,
  isMapType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'

import { getContainingTrack, getSession } from '../util/mstUtils.ts'
import { ElementId } from '../util/types/mst.ts'
import ConfigSlot, { slotWriteRefusal } from './configurationSlot.ts'
import { checkRequirements } from './requirements.ts'
import {
  getConfigurationSchemaMetadata,
  registerConfigurationSchema,
} from './schemaRegistry.ts'
import {
  identifierName,
  isConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'
import { preProcessSnapshotWith } from './snapshotPreprocess.ts'

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

export type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from './types.ts'

/**
 * The three entry kinds `makeConfigurationSchemaModel` classifies: a slot
 * definition, a constant (bare string/number), or a nested sub-schema — which
 * is the **MST type** `ConfigurationSchema()` returned, hence `IAnyType`.
 *
 * A raw nested `ConfigurationSchemaDefinition` used to be a fourth member here,
 * and it was both dead and load-bearing in the wrong direction: nothing
 * constructs a sub-schema from one (the loop has no branch for it, so it throws
 * "no type set for config slot"), while a plain object of strings and numbers is
 * exactly what a *slot definition* is — so every slot in the repo matched that
 * member instead and was never checked against `ConfigSlotDefinition` at all.
 * `type: 'enum'`, a name this system has never had, compiled for years that way.
 */
export interface ConfigurationSchemaDefinition {
  [n: string]: ConfigSlotDefinition | string | number | IAnyType
}

export interface ConfigurationSchemaOptions<
  BASE_SCHEMA extends AnyConfigurationSchemaType | undefined,
  EXPLICIT_IDENTIFIER extends string | undefined,
  // A parameter for the same reason `EXPLICIT_IDENTIFIER` is one: the prop it
  // installs is real, and a node that does not have it should not read as
  // though it does. Defaulted so the two-argument spelling still compiles —
  // most references name the options type rather than infer it.
  EXPLICITLY_TYPED extends boolean | undefined = boolean | undefined,
  REQUIREMENT extends ConfigurationSchemaRequirement =
    ConfigurationSchemaRequirement,
> {
  explicitlyTyped?: EXPLICITLY_TYPED
  explicitIdentifier?: EXPLICIT_IDENTIFIER
  implicitIdentifier?: string | boolean
  baseConfiguration?: BASE_SCHEMA

  actions?: (self: unknown) => any
  views?: (self: unknown) => any
  extend?: (self: unknown) => any
  /**
   * The slot a bare string snapshot lifts into, so `color: "red"` and
   * `color: { value: "red" }` are one config. Applied before
   * `preProcessSnapshot`, on every path a snapshot arrives by; the JSON schema,
   * `describeSlots` and the config editor read it here.
   */
  shorthand?: string
  /**
   * Slots a bare value sets beside `shorthand`, for a schema whose defaults
   * would hide it: LGVSyntenyColor's `field` defaults to `strand`, so its
   * `color: "steelblue"` is `{ value: "steelblue", scale: "none" }`.
   */
  shorthandWith?: Record<string, unknown>
  /**
   * Refuse a snapshot key the schema does not declare, where MST would drop
   * it in silence. Checked after the `shorthand` lift and before
   * `preProcessSnapshot`, on the same paths.
   */
  closed?: boolean
  /** A colour object's scale by `field` while `scale` is unset, `*` for any other. */
  fieldScale?: Readonly<Record<string, string>>
  preProcessSnapshot?: (
    snapshot: Record<string, unknown>,
  ) => Record<string, unknown>
  requires?: REQUIREMENT[]
}

type SchemaHook = (self: unknown) => any

/**
 * Options as **stored**: what a caller passes, except that the three
 * MST-chained hooks may have accumulated a chain by merging in a
 * `baseConfiguration`. A caller's single function is a valid chain of one, so
 * `ConfigurationSchemaOptions` is assignable to this and no call site changes.
 *
 * They stay a chain rather than being folded into one function because MST is
 * what does the chaining: `.actions()` is called once per entry, which is what
 * puts the base's members on `self` by the time the subclass's function runs,
 * and what lets the subclass override one by redeclaring its name. Folding to
 * `self => ({...base(self), ...child(self)})` would give neither, and would
 * corrupt `extend` outright (it returns `{actions, views, state}`, so a spread
 * merge drops whichever side declared fewer of the three).
 *
 * `preProcessSnapshot` is the exception and composes into a single function,
 * `child(base(snapshot))`: the base normalizes and migrates first, the subclass
 * refines. It has to stay one function because `preProcessSlotValues` calls it
 * straight off the registry (slotFacade.ts).
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

// base first, then child. Returns the single function unchanged when only one
// side declares the hook, so the common case never allocates a chain.
function chainHooks(
  base: SchemaHook | SchemaHook[] | undefined,
  child: SchemaHook | SchemaHook[] | undefined,
) {
  return base && child
    ? [...hookList(base), ...hookList(child)]
    : (child ?? base)
}

/**
 * Fold a subclass's schema definition over its `baseConfiguration`'s. New slots
 * are added and sub-schema entries replaced wholesale, but a slot the subclass
 * **redeclares merges field-by-field over the base's** — so an override states
 * only what actually differs and inherits the rest. (`type` comes along
 * regardless: it is what marks an entry as a slot rather than a nested
 * sub-schema, per `isSlotDefinitionEntry`.) The cases are pinned by the
 * "baseConfiguration slot override merge" tests.
 */
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
    // both sides must be slot definitions: a sub-schema (or a constant) is an
    // opaque entry with no fields to fold, so it keeps replace semantics
    if (isSlotDefinitionEntry(baseEntry) && isSlotDefinitionEntry(childEntry)) {
      merged[slot] = { ...baseEntry, ...childEntry }
    }
  }
  return merged
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

  // if we have a base configuration schema that we are
  // extending, grab the slot definitions from that
  let schemaDefinition = inputSchemaDefinition
  let options: MergedConfigurationSchemaOptions<any, any> = inputOptions
  const baseMeta = inputOptions.baseConfiguration
    ? getConfigurationSchemaMetadata(inputOptions.baseConfiguration)
    : undefined
  // A base with no registry entry used to be skipped in silence, producing a
  // schema missing every inherited slot with nothing thrown anywhere, and
  // reachable without doing anything obviously wrong: `isBareConfigurationSchemaType`
  // answers true for a `types.late` wrapper, and
  // `pluginManager.pluggableConfigSchemaType(…)` hands back a `types.union`.
  // Neither is registered, because only the type `ConfigurationSchema` itself
  // returns carries the slot table.
  if (inputOptions.baseConfiguration && !baseMeta) {
    throw new Error(
      `${modelName}'s baseConfiguration is not a configuration schema: it has no registered slot table, so every slot it was meant to inherit would be dropped silently. Pass the type ConfigurationSchema() returned, not a types.late wrapper, a union (pluginManager.pluggableConfigSchemaType), or a plain MST model.`,
    )
  }
  if (baseMeta) {
    schemaDefinition = mergeSchemaDefinition(
      baseMeta.definition,
      schemaDefinition,
    )
    // Everything else merges as a shallow `{...base, ...child}` spread, where
    // the child's value replaces the base's. The four hooks below must not:
    // `createBaseTrackConfig` alone declares two of them, so replace-semantics
    // meant no track config schema could ever declare its own without silently
    // dropping display-stub injection and the legacy-key migration. They
    // compose instead, base first. See MergedConfigurationSchemaOptions.
    const basePreProcess = baseMeta.options.preProcessSnapshot
    const childPreProcess = inputOptions.preProcessSnapshot
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
    }
  }
  return { schemaDefinition, options }
}

function makeConfigurationSchemaModel<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends MergedConfigurationSchemaOptions<any, any>,
>(modelName: string, schemaDefinition: DEFINITION, options: OPTIONS) {
  // now assemble the MST model of the configuration schema
  const modelDefinition: Record<string, any> = {}
  if (options.explicitlyTyped) {
    modelDefinition.type = types.optional(types.literal(modelName), modelName)
  }

  if (options.explicitIdentifier && options.implicitIdentifier) {
    throw new Error(
      `Cannot have both explicit and implicit identifiers in ${modelName}`,
    )
  }
  const identifier = identifierName(options)
  if (identifier) {
    modelDefinition[identifier] = options.explicitIdentifier
      ? types.identifier
      : ElementId
  }

  // String/number entries in the schema definition become volatile instance
  // constants (read via `model.someName`). Per-slot metadata lives in the
  // schema registry (a WeakMap keyed by the MST type, see schemaRegistry.ts),
  // not on the instance.
  const volatileConstants: Record<string, unknown> = {}
  // Keys of single sub-schema slots (not array/map-of-sub-schema). setSubschema
  // replaces such a node via `.create(data)`, which throws a confusing MST
  // validation error if pointed at an array/map-typed slot, so those are
  // excluded here — collected as the loop classifies each entry rather than
  // re-scanning modelDefinition afterward.
  const subSchemaKeys = new Set<string>()
  // Keys of array-of-sub-schema slots, which `setSubschemaArray` replaces
  // whole: a menu that authors a list of sub-schemas — the mark display's
  // `marks` — has no slot to write and no single node to swap.
  const arraySubSchemaKeys = new Set<string>()
  // The actual slots, which is a strictly smaller set than `modelDefinition`:
  // that also holds the sub-schema properties and the identifier, neither of
  // which setSlot may write. Same collect-as-you-classify as subSchemaKeys.
  const slotKeys = new Set<string>()
  const storesNull = new Set<string>()
  const featureFields = new Set<string>()
  const takesNoCallback = new Map<string, string>()
  for (const [slotName, slotDefinition] of Object.entries(schemaDefinition)) {
    if (isConfigurationSchemaType(slotDefinition)) {
      // a sub-configuration. A bare sub-schema is already stripDefault-wrapped
      // (so it strips when all-default); an array/map of sub-schemas gets
      // wrapped so an empty/default collection is likewise omitted from the
      // snapshot.
      if (isArrayType(slotDefinition)) {
        modelDefinition[slotName] = types.stripDefault(slotDefinition, [])
        arraySubSchemaKeys.add(slotName)
      } else if (isMapType(slotDefinition)) {
        modelDefinition[slotName] = types.stripDefault(slotDefinition, {})
      } else {
        modelDefinition[slotName] = slotDefinition
        subSchemaKeys.add(slotName)
      }
    } else if (isConstantEntry(slotDefinition)) {
      volatileConstants[slotName] = slotDefinition
    } else if (isSlotDefinitionEntry(slotDefinition)) {
      // slotDefinition is narrowed to ConfigSlotDefinition here (no cast)
      slotKeys.add(slotName)
      try {
        modelDefinition[slotName] = ConfigSlot(slotDefinition)
        if (modelDefinition[slotName].is(null)) {
          storesNull.add(slotName)
        }
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
      // an object that's neither a sub-schema nor a slot is almost always a
      // slot definition missing its required `type` field
      throw new Error(`no type set for config slot ${modelName}.${slotName}`)
    } else {
      throw new Error(
        `invalid configuration schema definition, "${slotName}" must be either a valid configuration slot definition, a constant, or a nested configuration schema`,
      )
    }
  }
  checkRequirements(modelName, schemaDefinition, options.requires ?? [])

  let completeModel = types
    .model(`${modelName}ConfigurationSchema`, modelDefinition)
    // annotated so `ConfigurationSchemaType['Type']`, which has to name these
    // three by hand (the model's own props are a `Record<string, any>`, so
    // nothing derived off them keeps a signature), cannot drift from them
    .actions((self): ConfigNodeActions => ({
      // `data` is whatever the sub-schema's `preProcessSnapshot` takes, a
      // string shorthand included.
      setSubschema(slotName: string, data: unknown) {
        if (!subSchemaKeys.has(slotName)) {
          throw new Error(`${slotName} is not a subschema, cannot replace`)
        }
        const newSchema = isStateTreeNode(data)
          ? data
          : modelDefinition[slotName].create(data)
        self[slotName] = newSchema
        return newSchema
      },
      setSubschemaArray(slotName: string, data: unknown[]) {
        if (!arraySubSchemaKeys.has(slotName)) {
          throw new Error(
            `${slotName} is not an array of subschemas, cannot replace`,
          )
        }
        self[slotName] = data
      },
      // generic slot setter the config editor's slot facade routes through. A
      // slot is a bare value-union property, so this is a plain assignment.
      //
      // **Don't weaken the membership check to a warning, and don't check
      // against `modelDefinition`** — that also holds the identifier and the
      // sub-schema properties, neither of which is a write this action is for.
      // Slot-name safety is a write guard (ADR-052); `setSlot`'s tests in
      // `configurationSchema.test.ts` pin both halves. `slotKeys` already has
      // base-schema slots merged in, so an inherited slot passes.
      // `null` resets, the same thing `undefined` does, because a JSON-borne
      // caller cannot spell `undefined`: a session spec, share link or agent
      // call can set a slot and then has no way to put it back. Omitting the
      // key is not that — this action is the merge path, where an absent key
      // means "leave it alone". A sub-schema already reads `null` this way
      // (`mergedSubschemaValue`), and no slot stores `null` as a value.
      setSlot(slotName: string, rawValue: unknown) {
        const value = rawValue ?? undefined
        if (!slotKeys.has(slotName)) {
          // the sub-schema branch re-classifies off the definition rather than
          // carrying a second Set: it runs only on the way to a throw, and the
          // predicate is the same one the loop above classified with
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
        // MST skips its own type check in a production build, and a value the
        // slot's union cannot take is then dropped with no throw: the write
        // reported success and the slot kept its old value. `is` still runs
        // there, so the guard holds in both builds.
        if (!modelDefinition[slotName].is(value)) {
          const declared = schemaDefinition[slotName]
          const slotType = isSlotDefinitionEntry(declared)
            ? declared.type
            : 'value'
          throw new Error(
            slotWriteRefusal(`${modelName}.${slotName}`, slotType, value),
          )
        }
        self[slotName] = value
      },
    }))

  if (Object.keys(volatileConstants).length) {
    completeModel = completeModel.volatile((/* self */) => volatileConstants)
  }
  // one MST call per entry, base's before the subclass's — chaining is what
  // makes the base's members visible on `self` inside the subclass's function
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
    storesNull,
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

  // stripDefault (not optional) so a nested all-default sub-schema is omitted
  // from its parent's snapshot: the slot props strip themselves, the sub-schema
  // collapses to its default, and the parent's stripDefault drops the key.
  const wrappedModel = types.stripDefault(completeModel, modelDefault)

  // Register metadata against BOTH handles: the inner model (what getType(node)
  // returns for a live config — the config editor's slot facade looks it up
  // from there) and the stripDefault wrapper (what ConfigurationSchema returns
  // and what sub-schema properties hold), so a lookup succeeds from either.
  registerConfigurationSchema(completeModel, metadata)
  registerConfigurationSchema(wrappedModel, metadata)

  return wrappedModel
}

/**
 * DEFINITION is unconstrained on purpose. It carries the *merged* definition —
 * `MergeConfigDef`, an unresolved conditional that cannot be checked against a
 * constraint — and intersecting it with `ConfigurationSchemaDefinition` to
 * satisfy one would put an index signature straight back into
 * `keyof DEFINITION`. The authoring check lives on `ConfigurationSchema`'s own
 * parameter, where the literal arrives, and on the `extends` clause below.
 */
export interface ConfigurationSchemaType<
  // `out`: a subclass schema is a superset of its base's slots, so it reads as
  // assignable where the base is expected. Without the annotation the parameter
  // measures as invariant and every display factory pinned to its base schema
  // refuses the subclass.
  out DEFINITION,
  OPTIONS extends ConfigurationSchemaOptions<any, any>,
> extends ReturnType<
  typeof makeConfigurationSchemaModel<
    DEFINITION & ConfigurationSchemaDefinition,
    OPTIONS
  >
> {
  /**
   * Overrides the factory's, whose props come off a `Record<string, any>` and
   * so admit every name. Slots come from the definition — the identifier and
   * an `explicitlyTyped` schema's `type` ride in as two of them — and the brand
   * names this schema, which is what `ConfigurationSchemaForModel` infers back
   * out.
   */
  readonly Type: ConfigNodeProps<DEFINITION> &
    ConfigNodeActions &
    ConfigNodeBrand<this>
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

export function ConfigurationSchema<
  // `const` preserves each slot's literal `type` ('stringArray', 'maybeNumber',
  // …) through inference so `SlotValueFromDef` can key on it and return a
  // precise value type instead of `any`. Scalar `defaultValue`s become literals
  // as a side effect, but `SlotValueFromDef` re-widens those, so read types stay
  // `number`/`string`/`boolean`, not `1`/`'x'`/`true`.
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
    RequirementOf<NoInfer<DEFINITION>, NoInfer<BASE_SCHEMA>>
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

// The frozen -> live half of TrackConfigurationReference's `get`, shared with
// hydrateTrackConfig below so there is one hydration rather than two that can
// drift on which env they build with. The memo it goes through belongs to the
// PluginManager instance (ADR-031): a node built with one instance's env must
// never be handed to another, and `pluginManager.hydratedTrackConfig` scopes
// that structurally rather than by convention.
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
 * Hydrate a plain track config into a live config node, dispatching on its
 * `type` to find the schema. `session.tracks` holds `types.frozen` plain
 * objects until something references a track (ADR-031). One of those holds only
 * what was literally authored: a slot at its schema default is absent,
 * `preProcessSnapshot` has not run, and nothing that walks a live node applies
 * to it.
 *
 * Use it where a caller needs the resolved config and may be handed either
 * form. The About dialog's "Copy config" is reached from two menus, and one of
 * them passes a `session.tracks` entry.
 *
 * Returns **undefined** when the config names a track type no plugin
 * registered, or when `create` rejects it as invalid. An un-hydrated config has
 * never been validated, so the dialog opening over it should not throw. Callers
 * fall back to using the plain object.
 *
 * Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating
 * the same entry twice returns the same node, and in an admin session a track
 * opened later resolves to that same node. A non-admin's open track
 * resolves to the session's private working copy (ADR-032), and this function
 * returns the pristine mirror beside it. The two have the same content;
 * `CopyConfigEntryPoints.test.ts` tests both cases.
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
    // getTrackType throws on an unregistered name rather than returning
    // undefined, so it is inside the guard with `create` — the two failures are
    // the same failure (nothing here can build this config) and neither should
    // reach a dialog that is only trying to show it
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

// A slot holding either an id string (resolved through `ref`) or a full inline
// config snapshot (held as a standalone schema instance). Both reference kinds
// resolve to `schemaType` instances, so MST can't auto-dispatch on the instance
// side — the explicit snapshot dispatcher (string → ref, object → schema)
// disambiguates. Shared by TrackConfigurationReference/DisplayConfigurationReference,
// and by neither accident nor oversight NOT by the plain branch — see the note
// on it in `ConfigurationReference`.
//
// One consequence, because both refs' `set` callbacks read as if it were not
// true: assigning a config **node** here does not store a reference to it. The
// dispatcher sees a non-string and picks `schemaType`, so MST tries to adopt the
// node as an inline child — which throws if it already has a parent. `set` is
// therefore unreachable on both refs (checked by making it throw: 231 suites
// stayed green), and exists only because MST rejects a custom reference
// declaring `get` without it. The plain branch, with no dispatcher, does the
// opposite and stores the reference.
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
 * Reference to a track configuration. Snapshot output is the trackId string.
 *
 * One load-bearing complication: **`types.union(trackRef, schemaType)` accepts a
 * string id OR a full config.** A view that synthesizes a track nobody else can
 * draw — a read-vs-ref synteny band, an SV inspector row, a circular view's
 * added track — writes the config here rather than registering it in
 * `session.tracks`, and it then lives and dies with the track that holds it.
 * `ReadVsRef.test.tsx` and `SVInspector.test.tsx` are the canaries.
 *
 * NOTE: don't add `as SCHEMATYPE` to the return value. It narrows SnapshotIn
 * to just the object branch, forcing callers to wrap string ids in
 * `@ts-expect-error`. The inferred union SnapshotIn is `string | SnapshotIn<schema>`.
 */
function TrackConfigurationReference(schemaType: IAnyType) {
  const trackRef = types.reference(schemaType, {
    get(id, parent) {
      const session = getSession(parent)
      // Per-id lookup: subscribes only to this trackId's derivation, so
      // resolving one track's config doesn't re-render the others. Derived on
      // read, so it's fresh during hydration and add-and-show — no dual path.
      let ret: unknown = session.getTrackById(String(id))
      if (!ret) {
        throw new Error(`Could not resolve trackId "${id}"`)
      }
      if (!isStateTreeNode(ret)) {
        // A non-admin session hands back a private, per-track working copy so a
        // shown track's in-place quick-edits (setSlot) mutate that copy and
        // never the shared frozen base node (see agent-docs/ADR-032). An admin
        // session returns undefined here and falls through to the frozen
        // hydration cache (ADR-031) — admin edits the frozen entry in place.
        const editable = (
          session as {
            getEditableTrackConfig?: (
              trackId: string,
              frozenConfig: unknown,
              schemaType: IAnyType,
            ) => unknown
          }
        ).getEditableTrackConfig?.(String(id), ret, schemaType)
        if (editable) {
          ret = editable
        } else {
          const env = getEnv<{ pluginManager: PluginManager }>(parent)
          ret = hydrateInto(env.pluginManager, schemaType, ret)
        }
      }
      return ret
    },
    set(value) {
      return value.trackId
    },
  })

  return idOrSnapshotUnion(trackRef, schemaType)
}

/**
 * Reference to a display configuration. Looked up inside the containing track
 * config's `displays` array. Snapshot output is the displayId string.
 *
 * Resolution order:
 *   1. by displayId
 *   2. by `parent.type` — handles old sessions where the saved displayId
 *      no longer matches but a display of the same type exists on the track
 *
 * Step 2 is the safety net because `baseTrackConfig.preProcessSnapshot`
 * already injects a stub display for every registered displayType on the
 * track, so a same-type lookup always succeeds at runtime for properly
 * loaded tracks. It is what carries a **renamed display type** across for a
 * catalog track: the injected stub is named for the new type, the display
 * model's own `preProcessSnapshot` rewrites the state model's, and the saved
 * `configuration` id still spells the old name, so only the type match
 * reconnects them. Not every pre-rename session reaches it — a track config
 * that itself declares the old display entry keeps that entry's `displayId`
 * through the alias rewrite (`{ ...d, type: canonical }`) and wins the
 * first-wins dedupe, so its session resolves by id. An older third step
 * auto-created a *detached* config when neither matched — that produced an
 * orphaned MST node whose edits silently didn't persist. Removed in favor of a
 * clear throw.
 *
 * The union's schemaType branch is symmetry with `TrackConfigurationReference`
 * rather than a path anything in tree takes: the two production writers,
 * `showTrackGeneric` and `BaseTrackModel.replaceDisplay`, both write a
 * displayId string, because a display config belongs in its track config's
 * `displays` array. It stays because it costs nothing and because dropping it
 * narrows `SnapshotIn` for every caller.
 */
function DisplayConfigurationReference(schemaType: IAnyType) {
  const displayRef = types.reference(schemaType, {
    get(id, parent) {
      // track.configuration is a hydrated MST node (hydrated lazily via
      // TrackConfigurationReference), so its displays array contains MST nodes.
      const track = getContainingTrack(parent)
      const displays = track.configuration.displays as {
        displayId: string
        type?: string
      }[]
      const displayType = (parent as { type?: string }).type
      let ret = displays.find(d => d.displayId === id)

      // Fallback: match by display type when the displayId isn't found.
      // baseTrackConfig.preProcessSnapshot injects a display entry for every
      // registered displayType for the track, so id-mismatch (e.g. an old
      // session with a different displayId convention) finds a same-type
      // entry here. The `if (displayType)` guard prevents an undefined
      // parent.type from silently matching a display whose `.type` is also
      // undefined.
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

// Instance (`Type`) a config reference reads as. A reference to a **concrete**
// schema reads as that schema's single-branded instance (`SCHEMA['Type']`, which
// carries `IStateTreeNode<SCHEMA>`), so `ConfigurationSchemaForModel` recovers
// the schema and `getConf` / `self.configuration` narrow. A reference to the
// **widened** `AnyConfigurationSchemaType` — a factory that hasn't tightened its
// `configSchema` param past it — has an `any` definition, so it reads `any`,
// exactly as before this type existed: such factories gain no narrowing (their
// slot values were already `any` via the `any` definition brand). The identifier
// prop rides in `SCHEMA['Type']`, folded into the definition.
type ConfigReferenceInstance<SCHEMA extends AnyConfigurationSchemaType> =
  SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? IsAny<D> extends true
      ? any
      : SCHEMA['Type']
    : SCHEMA['Type']

/**
 * Static type of the value `ConfigurationReference` produces, and therefore of a
 * track/display state model's `configuration` prop. Its **instance** type is a
 * clean, single-branded schema instance (see `ConfigReferenceInstance`), so
 * `ConfigurationSchemaForModel` — and thus `getConf(self, slot)` /
 * `readConfObject(self.configuration, slot)` — recovers the concrete schema and
 * its precise slot value types instead of `any`. The snapshot types stay
 * `id-string | schema-snapshot`, matching the runtime union (`idOrSnapshotUnion`):
 * a saved config serializes to its id string, and both an id string and a full
 * inline snapshot are accepted as input — so views that push string ids or
 * synthesized configs (`CircularView`, `SvInspectorView`) keep type-checking.
 *
 * Built by `Omit`-ing `Type` off `IType` and re-adding it, rather than reusing
 * the runtime `ITypeUnion`: `IType`'s own `Type` is `STNValue<T, this>`, which
 * re-brands `T` with `IStateTreeNode<this>`. Layering that over an already-branded
 * `SCHEMA['Type']` (which carries `IStateTreeNode<SCHEMA>`) double-brands the
 * node, and the two competing `IStateTreeNode<…>` brands defeat the single
 * `infer SCHEMA` in `ConfigurationSchemaForModel` (leaving it `any`). Re-adding a
 * plain `Type` keeps the single brand. See the "Config read type narrowing"
 * section of `packages/core/src/configuration/CLAUDE.md`.
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
 * Dispatch by the schema's identifier: `trackId` → track-ref (resolves through
 * `session.getTrackById`), `displayId` → display-ref (resolves through the
 * parent track's displays array), anything else → plain reference.
 *
 * Display schemas must declare `explicitIdentifier: 'displayId'` (directly or
 * via `baseConfiguration: baseLinearDisplayConfigSchema`, which merges its
 * options through `preprocessConfigurationSchemaArguments`).
 *
 * The return is annotated `IConfigurationReference<SCHEMATYPE>` (see its doc)
 * so `self.configuration` carries the concrete schema. The three runtime
 * branches produce MST reference/union types over `schemaType` that are
 * assignable to that annotation, so `return ref` needs no cast — and must not
 * get one: a prior `as SCHEMATYPE` was dropped because it narrowed `SnapshotIn`
 * to just the object branch and forced callers pushing string ids to
 * `@ts-expect-error` (see `TrackConfigurationReference`'s note).
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
        : // Plain (non-track/display) ref — internet accounts, connections —
          // resolved by MST's own identifier lookup rather than through the
          // session. **Deliberately not `idOrSnapshotUnion`**, even though it is
          // the same two members: this branch is also handed a *live, in-tree*
          // config node (`initializeInternetAccount` pushes
          // `jbrowse.internetAccounts[i]` straight through), and an undispatched
          // union sends that to the reference member because
          // `BaseReferenceType.isAssignableFrom` defers to its target type. A
          // `typeof snapshot === 'string'` dispatcher sends it to the schema
          // member instead, and MST refuses to adopt a node that already has a
          // parent. `InternetAccounts.test.ts` is the canary.
          types.union(types.reference(schemaType), schemaType)
  return ref
}
