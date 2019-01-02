import {
  types,
  isModelType,
  isArrayType,
  isUnionType,
  isMapType,
} from 'mobx-state-tree'

import { FileLocation, ElementId } from '../mst-types'

export const functionRegexp = /^\s*function\s*\(([^)]+)\)\s*{([\w\W]*)/
export function stringToFunction(str) {
  const match = functionRegexp.exec(str)
  if (!match)
    throw new Error('string does not appear to be a function declaration')
  const paramList = match[1].split(',').map(s => s.trim())
  const code = match[2].replace(/}\s*$/, '')
    const func = new Function(...paramList, `"use strict"; ${code}`) // eslint-disable-line
  return func
}

function isValidColorString(/* str */) {
  // TODO: check all the crazy cases for whether it's a valid HTML/CSS color string
  return true
}

function isEmptyObject(thing) {
  return (
    typeof thing === 'object' &&
    !Array.isArray(thing) &&
    Object.keys(thing).length === 0
  )
}

function isEmptyArray(thing) {
  return Array.isArray(thing) && thing.length === 0
}

const typeModels = {
  stringArray: types.array(types.string),
  boolean: types.boolean,
  color: types.refinement('Color', types.string, isValidColorString),
  integer: types.integer,
  number: types.number,
  string: types.string,
  fileLocation: FileLocation,
}

// custom actions for modifying the value models
const typeModelActions = {
  // special actions for working with stringArray slots
  stringArray: self => ({
    add(val) {
      self.value.push(val)
    },
    deleteAtIndex(idx) {
      self.value.splice(idx, 1)
    },
    setAtIndex(idx, val) {
      self.value[idx] = val
    },
  }),
}

const FunctionStringType = types.refinement(
  'FunctionString',
  types.string,
  str => /^\s*function\s*\(/.test(str),
)

function ConfigSlot(slotName, { description = '', model, type, defaultValue }) {
  if (!type) throw new Error('type name required')
  if (!model) model = typeModels[type]
  if (!model)
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )

  // these are any custom actions
  const modelCustomActions = typeModelActions[type] || (() => ({}))

  if (defaultValue === undefined) throw new Error(`no 'defaultValue' provided`)

  // if the `type` is something like `color`, then the model name
  // here will be `ColorConfigSlot`
  const configSlotModelName = `${slotName
    .charAt(0)
    .toUpperCase()}${slotName.slice(1)}ConfigSlot`
  const slot = types
    .model(configSlotModelName, {
      name: types.literal(slotName),
      description: types.literal(description),
      type: types.literal(type),
      value: types.optional(
        types.union(FunctionStringType, model),
        defaultValue,
      ),
    })
    .views(self => ({
      get func() {
        if (/^\s*function\s*\(/.test(self.value)) {
          // compile this as a function
          return stringToFunction(String(self.value))
        }
        return () => self.value
      },
    }))
    .preProcessSnapshot(
      val =>
        typeof val === 'object' && val.name === slotName
          ? val
          : {
              name: slotName,
              description,
              type,
              value: val,
            },
      // ({
      //   name: slotName,
      //   description,
      //   type,
      //   value: val,
      // }),
    )
    .postProcessSnapshot(snap =>
      snap.value !== defaultValue ? snap.value : undefined,
    )
    .actions(self => ({
      ...modelCustomActions(self),
      set(newVal) {
        self.value = newVal
      },
    }))

  const completeModel = types.optional(slot, {
    name: slotName,
    type,
    description,
    value: defaultValue,
  })
  completeModel.isJBrowseConfigurationSlot = true
  return completeModel
}

export function isConfigurationSchemaType(thing) {
  return (
    (isModelType(thing) && !!thing.isJBrowseConfigurationSchema) ||
    (isArrayType(thing) && isConfigurationSchemaType(thing.subType)) ||
    (isUnionType(thing) &&
      thing.types.every(t => isConfigurationSchemaType(t))) ||
    (isMapType(thing) && isConfigurationSchemaType(thing.subType))
  )
}

export function isConfigurationSlotType(thing) {
  return !!thing.isJBrowseConfigurationSlot
}

export function ConfigurationSchema(
  modelName,
  inputSchemaDefinition,
  options = {},
) {
  if (typeof modelName !== 'string')
    throw new Error(
      'first arg must be string name of the model that this config schema goes with',
    )

  // if we have a base configuration schema that we are extending, grab the slot definitions from that
  let schemaDefinition = inputSchemaDefinition
  if (
    options.baseConfiguration &&
    options.baseConfiguration.jbrowseSchemaDefinition
  ) {
    schemaDefinition = Object.assign(
      {},
      options.baseConfiguration.jbrowseSchemaDefinition,
      schemaDefinition,
    )
  }

  // now assemble the MST model of the configuration schema
  const modelDefinition = { _configId: ElementId }

  if (options.explicitlyTyped) modelDefinition.type = types.literal(modelName)

  const volatileConstants = {}
  Object.entries(schemaDefinition).forEach(([slotName, slotDefinition]) => {
    if (isConfigurationSchemaType(slotDefinition)) {
      // this is a sub-configuration
      modelDefinition[slotName] = slotDefinition
    } else if (typeof slotDefinition === 'object') {
      // this is a slot definition
      if (!slotDefinition.type)
        throw new Error(`no type set for config slot ${slotName}`)
      try {
        modelDefinition[slotName] = ConfigSlot(slotName, slotDefinition)
      } catch (e) {
        throw new Error(
          `invalid config slot definition for '${slotName}': ${e.message}`,
        )
      }
    } else if (
      typeof slotDefinition === 'string' ||
      typeof slotDefinition === 'number'
    ) {
      volatileConstants[slotName] = slotDefinition
    } else {
      throw new Error(
        `invalid configuration schema definition, "${slotName}" must be either a valid configuration slot definition, a constant, or a nested configuration schema`,
      )
    }
  })

  let completeModel = types.model(
    `${modelName}ConfigurationSchema`,
    modelDefinition,
  )
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
  completeModel = completeModel.postProcessSnapshot(snap => {
    const newSnap = {}
    // let keyCount = 0
    Object.entries(snap).forEach(([key, value]) => {
      if (
        value !== undefined &&
        !isEmptyObject(value) &&
        !isEmptyArray(value)
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
