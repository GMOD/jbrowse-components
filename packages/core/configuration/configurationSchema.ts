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

import ConfigSlot from './configurationSlot'
import { isConfigurationSchemaType } from './util'
import { getContainingTrack, getSession } from '../util'
import { ElementId } from '../util/types/mst'

import type { ConfigSlotDefinition } from './configurationSlot'
import type { AnyConfigurationSchemaType } from './types'
import type { IAnyType, SnapshotOut } from '@jbrowse/mobx-state-tree'

export type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSlot,
  AnyConfigurationSlotType,
} from './types'

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

  const volatileConstants: Record<string, any> = {
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
    // let keyCount = 0
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
      if (
        value !== undefined &&
        volatileConstants[key] === undefined &&
        !isEmptyObject(value) &&
        !isEmptyArray(value)
      ) {
        // keyCount += 1
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
 * Creates a reference type for track configurations that:
 * - Resolves trackId strings to configuration objects at runtime
 * - Always serializes as just the trackId string in snapshots
 * - Works with both frozen tracks (plain objects) and MST model tracks
 */
export function TrackConfigurationReference(schemaType: IAnyType) {
  const trackRef = types.reference(schemaType, {
    get(id, parent) {
      // First try to get from session.tracksById (works for frozen tracks)
      let ret = getSession(parent).tracksById?.[id]
      if (!ret) {
        // Fall back to resolveIdentifier (works for MST model tracks)
        // @ts-expect-error
        ret = resolveIdentifier(schemaType, getRoot(parent), id)
      }
      if (!ret) {
        throw new Error(`Track configuration "${id}" not found`)
      }
      // If it's a frozen/plain object, we need to instantiate it
      return isStateTreeNode(ret) ? ret : schemaType.create(ret, getEnv(parent))
    },
    set(value) {
      return value.trackId
    },
  })

  // Use snapshotProcessor to ensure we always serialize as just the trackId
  return types.snapshotProcessor(
    types.union({
      dispatcher: snapshot =>
        typeof snapshot === 'string' ? trackRef : schemaType,
    }, trackRef, schemaType),
    {
      preProcessor(snapshot: string | { trackId: string }) {
        // Accept both string IDs and full objects
        return snapshot
      },
      postProcessor(snapshot) {
        // Always serialize as just the trackId string
        if (typeof snapshot === 'object' && snapshot !== null && 'trackId' in snapshot) {
          return (snapshot as { trackId: string }).trackId
        }
        return snapshot
      },
    },
  )
}

/**
 * Creates a reference type for display configurations that:
 * - Resolves displayId strings to configuration objects at runtime
 * - Always serializes as just the displayId string in snapshots
 */
export function DisplayConfigurationReference(schemaType: IAnyType) {
  const displayRef = types.reference(schemaType, {
    get(id, parent) {
      const track = getContainingTrack(parent)
      // First try to find in the track's displays array
      let ret = track.configuration.displays?.find(
        (d: { displayId: string }) => d.displayId === id,
      )
      if (!ret) {
        // Fall back to resolveIdentifier
        // @ts-expect-error
        ret = resolveIdentifier(schemaType, getRoot(parent), id)
      }
      if (!ret) {
        throw new Error(`Display configuration "${id}" not found`)
      }
      return ret
    },
    set(value) {
      return value.displayId
    },
  })

  // Use snapshotProcessor to ensure we always serialize as just the displayId
  return types.snapshotProcessor(
    types.union({
      dispatcher: snapshot =>
        typeof snapshot === 'string' ? displayRef : schemaType,
    }, displayRef, schemaType),
    {
      preProcessor(snapshot: string | { displayId: string }) {
        // Accept both string IDs and full objects
        return snapshot
      },
      postProcessor(snapshot) {
        // Always serialize as just the displayId string
        if (typeof snapshot === 'object' && snapshot !== null && 'displayId' in snapshot) {
          return (snapshot as { displayId: string }).displayId
        }
        return snapshot
      },
    },
  )
}

export function ConfigurationReference<
  SCHEMATYPE extends AnyConfigurationSchemaType,
>(schemaType: SCHEMATYPE) {
  const name = schemaType.name
  // Check if this is a track configuration schema
  if (
    name.includes('TrackConfigurationSchema') &&
    !name.includes('DisplayConfigurationSchema')
  ) {
    return TrackConfigurationReference(schemaType) as SCHEMATYPE
  }
  // Check if this is a display configuration schema
  if (name.includes('DisplayConfigurationSchema')) {
    return DisplayConfigurationReference(schemaType) as SCHEMATYPE
  }
  // Default behavior for other configuration types
  // we cast this to SCHEMATYPE, because the reference *should* behave just
  // like the object it points to. It won't be undefined (this is a
  // `reference`, not a `safeReference`)
  return types.union(types.reference(schemaType), schemaType) as SCHEMATYPE
}
