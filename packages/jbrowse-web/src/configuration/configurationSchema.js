import { types, isType } from 'mobx-state-tree'

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

function isValidColorString(str) {
  // TODO: check all the crazy cases for whether it's a valid HTML/CSS color string
  return true
}

const typeModels = {
  color: types.refinement('Color', types.string, isValidColorString),
  integer: types.integer,
  number: types.number,
  string: types.string,
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
  // if the `type` is something like `color`, then the model name
  // here will be `ColorConfigSlot`
  const configSlotModelName = `${type.charAt(0).toUpperCase()}${type.slice(
    1,
  )}ConfigSlot`
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
    .actions(self => ({
      set(newVal) {
        self.value = newVal
      },
    }))

  return types.optional(slot, {
    name: slotName,
    type,
    description,
    value: defaultValue,
  })
}

export function ConfigurationSchema(modelName, schemaDefinition) {
  if (typeof modelName !== 'string')
    throw new Error(
      'first arg must be string name of the model that this config schema goes with',
    )
  const modelDefinition = {}
  Object.entries(schemaDefinition).forEach(([slotName, slotDefinition]) => {
    if (isType(slotDefinition)) {
      // this is a sub-configuration
      modelDefinition[slotName] = slotDefinition
    } else {
      // this is a slot definition
      if (!slotDefinition.type)
        throw new Error(`no type set for config slot ${slotName}`)
      modelDefinition[slotName] = ConfigSlot(slotName, slotDefinition)
    }
  })

  return types.optional(
    types.model(`${modelName}ConfigurationSchema`, modelDefinition),
    {},
  )
}
