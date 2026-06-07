import {
  getEnv,
  getRoot,
  isArrayType,
  isLateType,
  isMapType,
  isStateTreeNode,
  isType,
  resolveIdentifier,
  types,
} from '@jbrowse/mobx-state-tree'

import ConfigSlot from './configurationSlot.ts'
import {
  getConfigurationSchemaMetadata,
  registerConfigurationSchema,
} from './schemaRegistry.ts'
import { isConfigurationSchemaType } from './util.ts'
import { getContainingTrack, getSession } from '../util/index.ts'
import { ElementId } from '../util/types/mst.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationSchemaType } from './types.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

export type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSlot,
  AnyConfigurationSlotType,
} from './types.ts'

export interface ConfigurationSchemaDefinition {
  [n: string]:
    | ConfigSlotDefinition
    | ConfigurationSchemaDefinition
    | string
    | number
    | IAnyType
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
  let options = inputOptions
  const baseMeta = inputOptions.baseConfiguration
    ? getConfigurationSchemaMetadata(inputOptions.baseConfiguration)
    : undefined
  if (baseMeta) {
    schemaDefinition = {
      ...baseMeta.definition,
      ...schemaDefinition,
    }
    options = {
      ...baseMeta.options,
      ...inputOptions,
      baseConfiguration: undefined,
    }
  }
  return { schemaDefinition, options }
}

function makeConfigurationSchemaModel<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends ConfigurationSchemaOptions<any, any>,
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
  if (options.explicitIdentifier) {
    if (typeof options.explicitIdentifier === 'string') {
      modelDefinition[options.explicitIdentifier] = types.identifier
      identifier = options.explicitIdentifier
    } else {
      modelDefinition.id = types.identifier
      identifier = 'id'
    }
  } else if (options.implicitIdentifier) {
    if (typeof options.implicitIdentifier === 'string') {
      modelDefinition[options.implicitIdentifier] = ElementId
      identifier = options.implicitIdentifier
    } else {
      modelDefinition.id = ElementId
      identifier = 'id'
    }
  }

  // String/number entries in the schema definition become volatile instance
  // constants (read via `model.someName`). Per-slot metadata lives in the
  // jbrowseSchemaDefinition table on the schema type, not on the instance.
  const volatileConstants: Record<string, unknown> = {}
  for (const [slotName, slotDefinition] of Object.entries(schemaDefinition)) {
    if (
      (isType(slotDefinition) && isLateType(slotDefinition)) ||
      isConfigurationSchemaType(slotDefinition)
    ) {
      // an MST late() type (assumed to be a sub-configuration), or an actual
      // sub-configuration. A bare sub-schema is already stripDefault-wrapped (so
      // it strips when all-default); an array/map of sub-schemas gets wrapped so
      // an empty/default collection is likewise omitted from the snapshot.
      if (isArrayType(slotDefinition)) {
        modelDefinition[slotName] = types.stripDefault(slotDefinition, [])
      } else if (isMapType(slotDefinition)) {
        modelDefinition[slotName] = types.stripDefault(slotDefinition, {})
      } else {
        modelDefinition[slotName] = slotDefinition
      }
    } else if (
      typeof slotDefinition === 'string' ||
      typeof slotDefinition === 'number'
    ) {
      volatileConstants[slotName] = slotDefinition
    } else if (typeof slotDefinition === 'object') {
      // this is a slot definition
      if (!slotDefinition.type) {
        throw new Error(`no type set for config slot ${modelName}.${slotName}`)
      }
      try {
        modelDefinition[slotName] = ConfigSlot(
          slotDefinition as ConfigSlotDefinition,
        )
      } catch (e) {
        throw new Error(
          `invalid config slot definition for ${modelName}.${slotName}: ${e}`,
          { cause: e },
        )
      }
    } else {
      throw new Error(
        `invalid configuration schema definition, "${slotName}" must be either a valid configuration slot definition, a constant, or a nested configuration schema`,
      )
    }
  }

  // isConfigurationSchemaType walks union/optional/array/map types recursively;
  // computing the sub-schema key set once at schema construction makes
  // setSubschema's membership check a Set.has lookup.
  const subSchemaKeys = new Set(
    Object.keys(modelDefinition).filter(k =>
      isConfigurationSchemaType(modelDefinition[k]),
    ),
  )

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
      setSlot(slotName: string, value: unknown) {
        self[slotName] = value
      },
    }))

  if (Object.keys(volatileConstants).length) {
    completeModel = completeModel.volatile((/* self */) => volatileConstants)
  }
  if (options.actions) {
    completeModel = completeModel.actions(options.actions)
  }
  if (options.views) {
    completeModel = completeModel.views(options.views)
  }
  if (options.extend) {
    completeModel = completeModel.extend(options.extend)
  }

  const identifierDefault = identifier ? { [identifier]: 'placeholderId' } : {}
  const modelDefault = options.explicitlyTyped
    ? { type: modelName, ...identifierDefault }
    : identifierDefault

  if (options.preProcessSnapshot) {
    completeModel = completeModel.preProcessSnapshot(options.preProcessSnapshot)
  }

  // register the inner model type (not just the stripDefault wrapper below) so
  // metadata is reachable from a live node via getType(node) — the config
  // editor's slot facade looks it up from there.
  registerConfigurationSchema(completeModel, {
    definition: schemaDefinition,
    options,
  })

  // stripDefault (not optional) so a nested all-default sub-schema is omitted
  // from its parent's snapshot: the slot props strip themselves, the sub-schema
  // collapses to its default, and the parent's stripDefault drops the key.
  return types.stripDefault(completeModel, modelDefault)
}

export interface ConfigurationSchemaType<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends ConfigurationSchemaOptions<any, any>,
> extends ReturnType<typeof makeConfigurationSchemaModel<DEFINITION, OPTIONS>> {
  type: string
  [key: string]: unknown
}

export function ConfigurationSchema<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends ConfigurationSchemaOptions<BASE_SCHEMA, EXPLICIT_IDENTIFIER>,
  BASE_SCHEMA extends AnyConfigurationSchemaType | undefined = undefined,
  EXPLICIT_IDENTIFIER extends string | undefined = undefined,
>(
  modelName: string,
  inputSchemaDefinition: DEFINITION,
  inputOptions?: ConfigurationSchemaOptions<BASE_SCHEMA, EXPLICIT_IDENTIFIER>,
): ConfigurationSchemaType<DEFINITION, OPTIONS> {
  const { schemaDefinition, options } = preprocessConfigurationSchemaArguments(
    modelName,
    inputSchemaDefinition,
    inputOptions,
  )
  const schemaType = makeConfigurationSchemaModel(
    modelName,
    schemaDefinition,
    options,
  ) as AnyConfigurationSchemaType
  registerConfigurationSchema(schemaType, {
    definition: schemaDefinition,
    options,
  })
  return schemaType
}

// Lazy hydration cache for frozen track configs. jbrowse.tracks is
// types.frozen (plain objects) for large-tracklist performance; this WeakMap
// converts each frozen object to an MST node on first reference access.
// Keyed by the frozen object itself, so the entry is GC'd when updateTrackConf
// replaces the snapshot and nothing else holds the old reference.
const frozenTrackCache = new WeakMap<object, unknown>()

/**
 * Reference to a track configuration. Snapshot output is the trackId string.
 *
 * Two load-bearing complications, both for views that hold ephemeral track
 * configs without registering them in `session.tracks`:
 *
 * 1. **`get` falls back from `tracksById` to MST `resolveIdentifier`.**
 *    Required by `LinearSyntenyView.viewTrackConfigs` (LinearReadVsRef);
 *    `ReadVsRef.test.tsx` is the canary.
 *
 * 2. **`types.union(trackRef, schemaType)` accepts string id OR full snapshot.**
 *    Required by `CircularView.addTrackConf` / `SvInspectorView`, which push
 *    synthesized configs as full MST instances. `SVInspector.test.tsx` is the
 *    canary.
 *
 * Simplifying either requires first migrating view-local configs into the
 * session.
 *
 * NOTE: don't add `as SCHEMATYPE` to the return value. It narrows SnapshotIn
 * to just the object branch, forcing callers to wrap string ids in
 * `@ts-expect-error`. The inferred union SnapshotIn is `string | SnapshotIn<schema>`.
 */
export function TrackConfigurationReference(schemaType: IAnyType) {
  const trackRef = types.reference(schemaType, {
    get(id, parent) {
      let ret: unknown =
        getSession(parent).tracksById[id] ??
        // @ts-expect-error -- schemaType is IAnyType so resolveIdentifier's
        // generic can't narrow. Tree-wide MST identifier lookup; see the
        // function-level JSDoc for why this fallback is required.
        (resolveIdentifier(schemaType, getRoot(parent), id) as unknown)
      if (!ret) {
        throw new Error(`Could not resolve trackId "${id}"`)
      }
      if (!isStateTreeNode(ret)) {
        const cached = frozenTrackCache.get(ret)
        if (cached) {
          ret = cached
        } else {
          const model = schemaType.create(ret, getEnv(parent))
          frozenTrackCache.set(ret, model)
          ret = model
        }
      }
      return ret
    },
    set(value) {
      return value.trackId
    },
  })

  return types.union(
    {
      dispatcher: snapshot =>
        typeof snapshot === 'string' ? trackRef : schemaType,
    },
    trackRef,
    schemaType,
  )
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

  return types.union(
    {
      dispatcher: snapshot =>
        typeof snapshot === 'string' ? displayRef : schemaType,
    },
    displayRef,
    schemaType,
  )
}

/**
 * Dispatch by the schema's identifier: `trackId` → track-ref (resolves through
 * `session.tracksById`), `displayId` → display-ref (resolves through the
 * parent track's displays array), anything else → plain reference.
 *
 * Display schemas must declare `explicitIdentifier: 'displayId'` (directly or
 * via `baseConfiguration: baseLinearDisplayConfigSchema`, which merges its
 * options through `preprocessConfigurationSchemaArguments`).
 */
export function ConfigurationReference<
  SCHEMATYPE extends AnyConfigurationSchemaType,
>(schemaType: SCHEMATYPE) {
  const id =
    getConfigurationSchemaMetadata(schemaType)?.options.explicitIdentifier
  if (id === 'trackId') {
    return TrackConfigurationReference(schemaType)
  }
  if (id === 'displayId') {
    return DisplayConfigurationReference(schemaType)
  }
  // Plain (non-track/display) ref. The union accepts either an id string
  // (resolved via `types.reference`) or an inline schema snapshot (held as a
  // standalone schema instance).
  return types.union(types.reference(schemaType), schemaType)
}
