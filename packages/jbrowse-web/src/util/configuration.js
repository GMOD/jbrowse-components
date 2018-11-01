import { types, isStateTreeNode, getPropertyMembers } from 'mobx-state-tree'

import { isObservableArray, isObservableObject } from 'mobx'

export function getModelConfig(tree) {
  // if this is a node
  if (isStateTreeNode(tree)) {
    let config
    if (isObservableObject(tree)) {
      let keys
      //   if it has a 'configuration' view, use that as the node instead
      //   otherwise, just recurse through it normally
      if (tree.configuration) {
        tree = tree.configuration
        keys = Object.keys(tree)
      } else {
        keys = Object.keys(getPropertyMembers(tree).properties)
      }
      config = {}
      keys.forEach(key => {
        config[key] = getModelConfig(tree[key])
      })
    } else if (isObservableArray(tree)) {
      config = tree.map(getModelConfig)
    }

    return config
  }
  return tree
}

export function getConf(model, slotName, ...args) {
  const slot = model.configuration[slotName]
  if (!slot) throw new Error(`no slot "${slotName} found in configuration`)
  return slot.func.apply(null, args)
}

const typeModels = {
  color: types.string, // TODO: refine
  integer: types.integer,
}

function ConfigSlot(slotName, { description = '', model, type, defaultValue }) {
  if (!type) throw new Error('type name required')
  if (!model) model = typeModels[type]
  if (!model)
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )
  const slot = types
    .model(`${type.charAt(0).toUpperCase()}${type.slice(1)}ConfigSlot`, {
      name: types.literal(slotName),
      description: types.literal(description),
      type: types.literal(type),
      value: types.optional(model, defaultValue),
    })
    .views(self => ({
      get func() {
        if (/^\s*function\s*\(/.test(self.value)) {
          // compile this as a function
          let func
          eval(`func = ${self.value}`) // eslint-disable-line
          return func
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
  const modelDefinition = {}
  Object.entries(schemaDefinition).forEach(([slotName, slotDefinition]) => {
    if (!slotDefinition.type)
      throw new Error(`no type set for config slot ${slotName}`)
    modelDefinition[slotName] = ConfigSlot(slotName, slotDefinition)
  })

  return types.optional(
    types.model(`${modelName}ConfigurationSchema`, modelDefinition),
    {},
  )
}
