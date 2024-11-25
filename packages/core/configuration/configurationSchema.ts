import {
  types,
  isStateTreeNode,
  isType,
  isLateType,
  getSnapshot,
} from 'mobx-state-tree'

import ConfigSlot from './configurationSlot'
import { isConfigurationSchemaType } from './util'
import { ElementId } from '../util/types/mst'
import type { ConfigSlotDefinition } from './configurationSlot'
import type { AnyConfigurationSchemaType } from './types'
import type { IAnyType, SnapshotOut } from 'mobx-state-tree'

export type {
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
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
    }
    options.baseConfiguration = undefined
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
  Object.entries(schemaDefinition).forEach(([slotName, slotDefinition]) => {
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
  })

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

export function ConfigurationReference<
  SCHEMATYPE extends AnyConfigurationSchemaType,
>(schemaType: SCHEMATYPE) {
  // we cast this to SCHEMATYPE, because the reference *should* behave just
  // like the object it points to. It won't be undefined (this is a
  // `reference`, not a `safeReference`)
  return types.union(types.reference(schemaType), schemaType) as SCHEMATYPE
}
