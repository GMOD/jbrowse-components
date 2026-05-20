import {
  getEnv,
  getRoot,
  getSnapshot,
  isLateType,
  isStateTreeNode,
  isType,
  resolveIdentifier,
  types,
} from '@jbrowse/mobx-state-tree'

import ConfigSlot from './configurationSlot.ts'
import { isConfigurationSchemaType } from './util.ts'
import { getContainingTrack, getSession } from '../util/index.ts'
import { ElementId } from '../util/types/mst.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationSchemaType } from './types.ts'
import type { IAnyType, SnapshotOut } from '@jbrowse/mobx-state-tree'

export type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSlot,
  AnyConfigurationSlotType,
} from './types.ts'

function isEmptyObject(thing: unknown) {
  return (
    typeof thing === 'object' &&
    !Array.isArray(thing) &&
    thing !== null &&
    Object.keys(thing).length === 0
  )
}

function isEmptyArray(thing: unknown) {
  return Array.isArray(thing) && thing.length === 0
}

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
  if (inputOptions.baseConfiguration?.jbrowseSchemaDefinition) {
    schemaDefinition = {
      ...inputOptions.baseConfiguration.jbrowseSchemaDefinition,
      ...schemaDefinition,
    }
    options = {
      ...inputOptions.baseConfiguration.jbrowseSchemaOptions,
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

  const volatileConstants: Record<string, unknown> = {
    isJBrowseConfigurationSchema: true,
    jbrowseSchema: {
      modelName,
      definition: schemaDefinition,
      options,
    },
  }
  for (const [slotName, slotDefinition] of Object.entries(schemaDefinition)) {
    if (
      (isType(slotDefinition) && isLateType(slotDefinition)) ||
      isConfigurationSchemaType(slotDefinition)
    ) {
      // this is either an MST late() type (which we assume to be a sub-configuration),
      // or an actual sub-configuration
      modelDefinition[slotName] = slotDefinition
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
          slotName,
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

  let completeModel = types
    .model(`${modelName}ConfigurationSchema`, modelDefinition)
    .actions(self => ({
      setSubschema(slotName: string, data: Record<string, unknown>) {
        if (!isConfigurationSchemaType(modelDefinition[slotName])) {
          throw new Error(`${slotName} is not a subschema, cannot replace`)
        }
        const newSchema = isStateTreeNode(data)
          ? data
          : modelDefinition[slotName].create(data)
        self[slotName] = newSchema
        return newSchema
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

  const defaultSnap = getSnapshot(completeModel.create(modelDefault))
  completeModel = completeModel.postProcessSnapshot(snap => {
    const newSnap: SnapshotOut<typeof completeModel> = {}
    let matchesDefault = true
    for (const [key, value] of Object.entries(snap)) {
      if (matchesDefault) {
        if (typeof defaultSnap[key] === 'object' && typeof value === 'object') {
          if (JSON.stringify(defaultSnap[key]) !== JSON.stringify(value)) {
            matchesDefault = false
          }
        } else if (defaultSnap[key] !== value) {
          matchesDefault = false
        }
      }
      // Omit undefined values and volatile constants.
      // Only skip empty objects/arrays for sub-schema keys — slot values of []
      // or {} must be preserved even when empty, since they may differ from a
      // non-empty default (isEmptyArray/isEmptyObject on a slot value would
      // cause it to silently revert to the default on next load).
      const isSubSchema = isConfigurationSchemaType(modelDefinition[key])
      if (
        value !== undefined &&
        volatileConstants[key] === undefined &&
        !(isSubSchema && (isEmptyObject(value) || isEmptyArray(value)))
      ) {
        newSnap[key] = value
      }
    }
    if (matchesDefault) {
      return {}
    }
    return newSnap
  })

  if (options.preProcessSnapshot) {
    completeModel = completeModel.preProcessSnapshot(options.preProcessSnapshot)
  }

  return types.optional(completeModel, modelDefault)
}

export interface ConfigurationSchemaType<
  DEFINITION extends ConfigurationSchemaDefinition,
  OPTIONS extends ConfigurationSchemaOptions<any, any>,
> extends ReturnType<typeof makeConfigurationSchemaModel<DEFINITION, OPTIONS>> {
  isJBrowseConfigurationSchema: boolean
  jbrowseSchemaDefinition: DEFINITION
  jbrowseSchemaOptions: OPTIONS
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
  // saving a couple of jbrowse-specific things in the type object. hope nobody gets mad.
  schemaType.isJBrowseConfigurationSchema = true
  schemaType.jbrowseSchemaDefinition = schemaDefinition
  schemaType.jbrowseSchemaOptions = options
  return schemaType
}

/**
 * Reference to a track configuration. Snapshot output is the trackId string.
 *
 * Two-step resolution: `session.tracksById` first (the hot path — every
 * session-scoped track is hydrated and cached there by
 * TracksManagerSessionMixin), then MST `resolveIdentifier` against the root
 * as a fallback.
 *
 * The fallback is load-bearing for tracks that live OUTSIDE `session.tracks`.
 * The concrete case is `LinearSyntenyView.viewTrackConfigs`: that view holds
 * inline synteny-track configs scoped to the view, not the session, so
 * `tracksById` never sees them. The LinearReadVsRef panel exercises this
 * path — its `ReadVsRef.test.tsx` integration test will fail with
 * "Could not resolve trackId" if the fallback is removed. Removing the
 * fallback also breaks any other view that stores configs on itself rather
 * than in the session (e.g. dotplot's inline-config call sites prior to
 * commit 5bec022a10 — those were rewritten to pass id strings, but the
 * view-local-config pattern itself is still supported precisely because of
 * this fallback).
 */
export function TrackConfigurationReference(schemaType: IAnyType) {
  const trackRef = types.reference(schemaType, {
    get(id, parent) {
      const ret =
        getSession(parent).tracksById[id] ??
        // @ts-expect-error -- schemaType is IAnyType so resolveIdentifier's
        // generic can't narrow. Tree-wide MST identifier lookup; see the
        // function-level JSDoc for why this fallback is required.
        (resolveIdentifier(schemaType, getRoot(parent), id) as unknown)
      if (!ret) {
        throw new Error(`Could not resolve trackId "${id}"`)
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
 *   3. auto-create a detached default — handles new display types added to
 *      the schema that weren't present in the saved track config
 *
 * The auto-create path produces a config that is NOT in
 * `track.configuration.displays`. Edits via the editor widget will not persist
 * (no path from the saved snapshot back). Acceptable for ephemeral defaults;
 * if persistence matters the config must be appended via an action.
 */
export function DisplayConfigurationReference(schemaType: IAnyType) {
  const displayRef = types.reference(schemaType, {
    get(id, parent) {
      // track.configuration is already a hydrated MST node (see
      // TracksManagerSessionMixin.tracksById), so its displays array contains
      // MST display-config nodes directly.
      const track = getContainingTrack(parent)
      const displays = track.configuration.displays
      let ret = displays.find((d: { displayId: string }) => d.displayId === id)

      // Fallback: match by display type when the displayId isn't found.
      // This handles state models whose display type wasn't registered when
      // the track config was written.
      //
      // The `if (displayType)` guard is important: without it, an undefined
      // displayType would `find` a display whose own `.type` is also
      // undefined — a silent wrong match. In practice parent.type is always
      // a string literal, but we guard defensively so the throw fires
      // cleanly if anything goes wrong upstream.
      if (!ret) {
        const displayType = (parent as { type?: string }).type
        if (displayType) {
          ret = displays.find(
            (d: unknown) => (d as { type?: string }).type === displayType,
          )
          // CAVEAT: this auto-created config is *detached* — it is not added
          // to track.configuration.displays, so user edits via the editor
          // widget will not persist. Acceptable for ephemeral defaults of
          // display types whose config wasn't in the saved track, but if
          // saving edits matters here the config must be appended to the
          // track's displays array via an action.
          ret ??= schemaType.create(
            { displayId: `${id}`, type: displayType },
            getEnv(parent),
          )
        }
      }

      if (!ret) {
        const displayType = (parent as { type?: string }).type
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
  const id = schemaType.jbrowseSchemaOptions?.explicitIdentifier
  if (id === 'trackId') {
    return TrackConfigurationReference(schemaType) as SCHEMATYPE
  }
  if (id === 'displayId') {
    return DisplayConfigurationReference(schemaType) as SCHEMATYPE
  }
  // Cast to SCHEMATYPE because the reference behaves just like the object it
  // points to — it won't be undefined (this is a `reference`, not `safeReference`)
  return types.union(types.reference(schemaType), schemaType) as SCHEMATYPE
}
