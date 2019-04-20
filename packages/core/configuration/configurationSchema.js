import {
  types,
  isModelType,
  isArrayType,
  isUnionType,
  isMapType,
  isStateTreeNode,
  getType,
  isOptionalType,
} from 'mobx-state-tree'

import { ElementId } from '../mst-types'

import ConfigSlot from './configurationSlot'
import { getUnionSubTypes, getSubType, getDefaultValue } from '../util/mst-reflection'

function isEmptyObject(thing) {
  return (
    typeof thing === 'object'
    && !Array.isArray(thing)
    && Object.keys(thing).length === 0
  )
}

function isEmptyArray(thing) {
  return Array.isArray(thing) && thing.length === 0
}

export function isConfigurationSchemaType(thing) {
  if (!thing) return false

  // written as a series of if-statements instead of a big logical OR
  // because this construction gives much better debugging backtraces.

  // also, note that the order of these statements matters, because
  // for example some union types are also optional types

  if (
    isModelType(thing)
    && (!!thing.isJBrowseConfigurationSchema
      || (thing.identifierAttribute === 'configId'
        && thing.name.includes('ConfigurationSchema')))
  ) { return true }

  if (
    isUnionType(thing)) {
    return getUnionSubTypes(thing).every(t => isConfigurationSchemaType(t) || t.name === 'undefined')
  }

  if (isOptionalType(thing) && isConfigurationSchemaType(getSubType(thing))) { return true }

  if (isArrayType(thing) && isConfigurationSchemaType(getSubType(thing))) { return true }

  if (isMapType(thing) && isConfigurationSchemaType(getSubType(thing))) { return true }

  return false
}

export function isConfigurationModel(thing) {
  return isStateTreeNode(thing) && isConfigurationSchemaType(getType(thing))
}

/**
 * given a union of explicitly typed configuration schema types,
 * extract an array of the type names contained in the union
 *
 * @param {mst union type} unionType
 * @returns {Array[string]} type names contained in the union
 */
export function getTypeNamesFromExplicitlyTypedUnion(unionType) {
  if (isUnionType(unionType)) {
    const typeNames = []
    getUnionSubTypes(unionType).forEach((type) => {
      let typeName = getTypeNamesFromExplicitlyTypedUnion(type)
      if (!typeName.length) typeName = [getDefaultValue(type).type]
      if (!typeName[0]) {
        // debugger
        throw new Error('invalid config schema type', type)
      }
      typeNames.push(...typeName)
    })
    return typeNames
  }
  return []
}

export function isConfigurationSlotType(thing) {
  return !!thing.isJBrowseConfigurationSlot
}

export function ConfigurationSchema(
  modelName,
  inputSchemaDefinition,
  options = {},
) {
  if (typeof modelName !== 'string') {
    throw new Error(
      'first arg must be string name of the model that this config schema goes with',
    )
  }

  // if we have a base configuration schema that we are
  // extending, grab the slot definitions from that
  let schemaDefinition = inputSchemaDefinition
  if (
    options.baseConfiguration
    && options.baseConfiguration.jbrowseSchemaDefinition
  ) {
    schemaDefinition = Object.assign(
      {},
      options.baseConfiguration.jbrowseSchemaDefinition,
      schemaDefinition,
    )
  }

  // now assemble the MST model of the configuration schema
  const modelDefinition = {
    configId: options.singleton
      ? types.optional(
        types.refinement(types.identifier, t => t === modelName),
        modelName,
      )
      : ElementId,
  }

  if (options.explicitlyTyped) {
    modelDefinition.type = types.optional(types.literal(modelName), modelName)
  }

  const volatileConstants = {
    isJBrowseConfigurationSchema: true,
    jbrowseSchema: {
      modelName,
      definition: schemaDefinition,
      options,
    },
  }
  Object.entries(schemaDefinition).forEach(([slotName, slotDefinition]) => {
    if (isConfigurationSchemaType(slotDefinition)) {
      // this is a sub-configuration
      modelDefinition[slotName] = slotDefinition
    } else if (typeof slotDefinition === 'object') {
      // this is a slot definition
      if (!slotDefinition.type) { throw new Error(`no type set for config slot ${modelName}.${slotName}`) }
      try {
        modelDefinition[slotName] = ConfigSlot(slotName, slotDefinition)
      } catch (e) {
        throw new Error(
          `invalid config slot definition for ${modelName}.${slotName}: ${
            e.message
          }`,
        )
      }
    } else if (
      typeof slotDefinition === 'string'
      || typeof slotDefinition === 'number'
    ) {
      volatileConstants[slotName] = slotDefinition
    } else {
      throw new Error(
        `invalid configuration schema definition, "${slotName}" must be either a valid configuration slot definition, a constant, or a nested configuration schema`,
      )
    }
  })

  let completeModel = types
    .model(`${modelName}ConfigurationSchema`, modelDefinition)
    .actions(self => ({
      setSubschema(slotName, data) {
        if (!isConfigurationSchemaType(modelDefinition[slotName])) { throw new Error(`${slotName} is not a subschema, cannot replace`) }
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
  completeModel = completeModel.postProcessSnapshot((snap) => {
    const newSnap = {}
    // let keyCount = 0
    Object.entries(snap).forEach(([key, value]) => {
      if (
        value !== undefined
        && volatileConstants[key] === undefined
        && !isEmptyObject(value)
        && !isEmptyArray(value)
      ) {
        // keyCount += 1
        newSnap[key] = value
      }
    })
    return newSnap
  })

  const schemaType = types.optional(
    completeModel,
    options.explicitlyTyped ? { type: modelName } : {},
  )

  // save a couple of jbrowse-specific things in the type object. hope nobody gets mad.
  schemaType.isJBrowseConfigurationSchema = true
  schemaType.jbrowseSchemaDefinition = schemaDefinition
  return schemaType
}

export function ConfigurationReference(schemaType) {
  return types.union(types.reference(schemaType), schemaType)
}
