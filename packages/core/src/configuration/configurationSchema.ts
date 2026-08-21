import {
  getEnv,
  isArrayType,
  isMapType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'

import { getContainingTrack, getSession } from '../util/mstUtils.ts'
import { ElementId } from '../util/types/mst.ts'
import ConfigSlot from './configurationSlot.ts'
import {
  getConfigurationSchemaMetadata,
  registerConfigurationSchema,
} from './schemaRegistry.ts'
import {
  isConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'

import type PluginManager from '../PluginManager.ts'
import type { IsAny } from '../util/types/isAny.ts'
import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  GetInheritedIdentifier,
} from './types.ts'
import type {
  IAnyType,
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
> {
  explicitlyTyped?: boolean
  explicitIdentifier?: EXPLICIT_IDENTIFIER
  implicitIdentifier?: string | boolean
  baseConfiguration?: BASE_SCHEMA

  actions?: (self: unknown) => any
  views?: (self: unknown) => any
  extend?: (self: unknown) => any
  preProcessSnapshot?: (
    snapshot: Record<string, unknown>,
  ) => Record<string, unknown>
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
 * sub-schema, per `isSlotDefinitionEntry`.)
 *
 * A subclass that really wants a plain slot states `promotedBase: undefined`,
 * which works *because* this is a spread: a stated `undefined` overwrites the
 * base's value where an omitted key would inherit it. The four cases are pinned
 * by the "baseConfiguration slot override merge" tests.
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
  let identifier: string | undefined

  if (options.explicitlyTyped) {
    modelDefinition.type = types.optional(types.literal(modelName), modelName)
  }

  if (options.explicitIdentifier && options.implicitIdentifier) {
    throw new Error(
      `Cannot have both explicit and implicit identifiers in ${modelName}`,
    )
  }
  // explicit identifiers are plain MST identifiers (caller-supplied id);
  // implicit identifiers auto-generate via ElementId. Both name the field after
  // the option string, or default to `id` when the option is just `true`.
  const idSpec = options.explicitIdentifier
    ? { name: options.explicitIdentifier, idType: types.identifier }
    : options.implicitIdentifier
      ? { name: options.implicitIdentifier, idType: ElementId }
      : undefined
  if (idSpec) {
    identifier = typeof idSpec.name === 'string' ? idSpec.name : 'id'
    modelDefinition[identifier] = idSpec.idType
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
  // The actual slots, which is a strictly smaller set than `modelDefinition`:
  // that also holds the sub-schema properties and the identifier, neither of
  // which setSlot may write. Same collect-as-you-classify as subSchemaKeys.
  const slotKeys = new Set<string>()
  for (const [slotName, slotDefinition] of Object.entries(schemaDefinition)) {
    if (isConfigurationSchemaType(slotDefinition)) {
      // a sub-configuration. A bare sub-schema is already stripDefault-wrapped
      // (so it strips when all-default); an array/map of sub-schemas gets
      // wrapped so an empty/default collection is likewise omitted from the
      // snapshot.
      if (isArrayType(slotDefinition)) {
        modelDefinition[slotName] = types.stripDefault(slotDefinition, [])
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

  let completeModel = types
    .model(`${modelName}ConfigurationSchema`, modelDefinition)
    .actions(self => ({
      setSubschema(slotName: string, data: Record<string, unknown>) {
        if (!subSchemaKeys.has(slotName)) {
          throw new Error(`${slotName} is not a subschema, cannot replace`)
        }
        const newSchema = isStateTreeNode(data)
          ? data
          : modelDefinition[slotName].create(data)
        self[slotName] = newSchema
        return newSchema
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
      setSlot(slotName: string, value: unknown) {
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
  if (options.preProcessSnapshot) {
    completeModel = completeModel.preProcessSnapshot(options.preProcessSnapshot)
  }

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
  const metadata = { definition: schemaDefinition, options }
  registerConfigurationSchema(completeModel, metadata)
  registerConfigurationSchema(wrappedModel, metadata)

  return wrappedModel
}

export interface ConfigurationSchemaType<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends ConfigurationSchemaOptions<any, any>,
> extends ReturnType<typeof makeConfigurationSchemaModel<DEFINITION, OPTIONS>> {
  type: string
}

export function ConfigurationSchema<
  // `const` preserves each slot's literal `type` ('stringArray', 'maybeNumber',
  // …) through inference so `SlotValueFromDef` can key on it and return a
  // precise value type instead of `any`. Scalar `defaultValue`s become literals
  // as a side effect, but `SlotValueFromDef` re-widens those, so read types stay
  // `number`/`string`/`boolean`, not `1`/`'x'`/`true`.
  const DEFINITION extends ConfigurationSchemaDefinition,
  BASE_SCHEMA extends AnyConfigurationSchemaType | undefined = undefined,
  EXPLICIT_IDENTIFIER extends string | undefined = undefined,
>(
  modelName: string,
  inputSchemaDefinition: DEFINITION,
  inputOptions?: ConfigurationSchemaOptions<BASE_SCHEMA, EXPLICIT_IDENTIFIER>,
): ConfigurationSchemaType<
  DEFINITION,
  ConfigurationSchemaOptions<BASE_SCHEMA, EXPLICIT_IDENTIFIER>
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

// The hydration cache lives on the PluginManager instance (see
// trackConfigHydrationCache's doc comment there and ADR-031), not as a
// module-level singleton: it must never hand a track resolved on one
// PluginManager instance a node built with another instance's env, and
// scoping it to the instance rules that out structurally rather than by
// convention. Nested a second level by schemaType, since one PluginManager
// registers a distinct schemaType per track type.
function frozenTrackHydrationCache(
  pluginManager: PluginManager,
  schemaType: IAnyType,
) {
  const byType = pluginManager.trackConfigHydrationCache
  let cache = byType.get(schemaType)
  if (!cache) {
    cache = new WeakMap()
    byType.set(schemaType, cache)
  }
  return cache
}

// The frozen -> live half of TrackConfigurationReference's `get`, shared with
// hydrateTrackConfig below so there is one hydration and one cache rather than
// two that can drift on which env or which key they use.
function hydrateInto(
  pluginManager: PluginManager,
  schemaType: IAnyType,
  frozen: object,
) {
  const cache = frozenTrackHydrationCache(pluginManager, schemaType)
  const cached = cache.get(frozen)
  if (cached) {
    return cached
  }
  const model = schemaType.create(frozen, { pluginManager })
  cache.set(frozen, model)
  return model
}

/**
 * #api core/configuration
 * Hydrate a plain track config into a live config node, dispatching on its
 * `type` to find the schema. `session.tracks` holds `types.frozen` plain
 * objects until something references a track (ADR-031), so a caller handed one
 * of those has a config that reads nothing but what was literally authored: a
 * slot at its schema default is absent, `preProcessSnapshot` has not run, and
 * nothing that walks a live node — the promotable cascade above all — applies
 * to it.
 *
 * For the callers that need the resolved answer rather than the authored one
 * and cannot know which of the two they were handed. The About dialog's "Copy
 * config" is the case this exists for: it is reached from two menus, and one of
 * them passes a `session.tracks` entry.
 *
 * Returns **undefined** rather than throwing when the config names a track type
 * no plugin registered, or when it is invalid enough that `create` rejects it —
 * an un-hydrated config has never been validated, so a dialog that opens over
 * it must not be the thing that discovers this. Callers fall back to treating
 * it as the plain object it is.
 *
 * Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating
 * the same entry twice returns the same node and a track that gets opened later
 * reuses it.
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
// disambiguates. Shared by TrackConfigurationReference/DisplayConfigurationReference.
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
export function TrackConfigurationReference(schemaType: IAnyType) {
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
        // never the shared frozen base node (see agent-docs/ADR-032). Admin and
        // embedded sessions return undefined here and fall through to the frozen
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
 * loaded tracks. An older third step auto-created a *detached* config when
 * neither matched — that produced an orphaned MST node whose edits silently
 * didn't persist. Removed in favor of a clear throw, since
 * preProcessSnapshot's injection makes the path effectively dead.
 *
 * Union-with-schemaType branch is for the same reason as `TrackConfigurationReference`:
 * `CircularView.addTrackConf` passes inline display configs as MST instances.
 */
export function DisplayConfigurationReference(schemaType: IAnyType) {
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
// slot values were already `any` via the `any` definition brand).
//
// Both branches are intersected with the schema's identifier prop, because
// `makeConfigurationSchemaModel` builds the model from a `Record<string, any>`
// `modelDefinition`, which erases every named prop — including the identifier it
// installs from `explicitIdentifier`/`implicitIdentifier`. Without this, a
// **concrete** display instance fails the repo-wide structural check of a display
// against `{ displayId: string }` (`DisplayModel`, `DisplayContainer`), which is
// what blocked pinning the widened display factories: pinning turns a vacuously-
// passing `any` into a real instance with no `displayId` on it. The widened
// branch is unaffected (`any & X` is `any`). See the "Config read type narrowing"
// section of `./CLAUDE.md`.
type ConfigReferenceInstance<SCHEMA extends AnyConfigurationSchemaType> =
  (SCHEMA extends ConfigurationSchemaType<infer D, any>
    ? IsAny<D> extends true
      ? any
      : SCHEMA['Type']
    : SCHEMA['Type']) & {
    [K in GetInheritedIdentifier<SCHEMA>]: string
  }

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
        : // Plain (non-track/display) ref. The union accepts either an id
          // string (resolved via `types.reference`) or an inline schema
          // snapshot (held as a standalone schema instance).
          types.union(types.reference(schemaType), schemaType)
  return ref
}
