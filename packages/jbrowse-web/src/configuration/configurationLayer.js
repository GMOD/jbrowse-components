import {
  types,
  getRoot,
  getParent,
  isArrayType,
  isMapType,
  resolveIdentifier,
  resolvePath,
  isUnionType,
  isOptionalType,
} from 'mobx-state-tree'

import ConfigurationSlot from './configurationSlot'
import { inDevelopment } from '../util'
import { stringToFunction } from '../util/functionStrings'
import { isConfigurationSchemaType } from './configurationSchema'

function ConfigurationLayerSlot(
  slotName,
  parentSlotType,
  parentSlotDefinition,
) {
  let layerSlot = ConfigurationSlot(slotName, parentSlotDefinition)
  layerSlot = types
    .compose(
      layerSlot.type,
      types.model({
        value: types.maybe(parentSlotType.properties.value.type),
      }),
    )
    .views(self => ({
      get func() {
        if (self.value === undefined) {
          return self.parentSlot.func
        }
        if (self.isCallback) {
          // compile this as a function
          return stringToFunction(String(self.value), {
            bind: [getRoot(self)],
            verifyFunctionSignature: inDevelopment
              ? self.parentSlot.functionSignature
              : undefined,
          })
        }
        return () => self.value
      },

      get parentSlot() {
        const schema = getParent(self, 1)
        return schema.parent[self.name]
      },
    }))

  return layerSlot
}

/**
 * creates a configuration "layer" type, which is designed to inherit
 * configuration values from a parent configuration
 *
 * @param {ConfigurationSchema} parentSchemaType
 */
function ConfigurationLayer(parentSchemaType) {
  if (!isConfigurationSchemaType(parentSchemaType))
    throw new TypeError('must pass a ConfigurationSchema type')
  // iterate over the slots in the parent type and make layerSlots in this object for each of them

  const layerModelDefinition = {
    parentConfigId: types.maybe(types.string),
    parentConfigPath: types.maybe(types.string),
  }

  const schemaMetaData = parentSchemaType.create().jbrowseSchema
  const { /* modelName, options, */ definition } = schemaMetaData
  Object.entries(definition).forEach(([memberName, slotDefinition]) => {
    if (
      typeof slotDefinition === 'string' ||
      typeof slotDefinition === 'number'
    ) {
      // this is a constant
      layerModelDefinition[memberName] = types.literal(slotDefinition)
      // throw new Error('fu')
    } else {
      let parentActualType = parentSchemaType
      if (isOptionalType(parentSchemaType))
        parentActualType = parentSchemaType.type

      let memberType = parentActualType.properties[memberName]

      if (isUnionType(memberType)) {
        layerModelDefinition[memberName] = types.union(
          ...memberType.types.map(t => ConfigurationLayer(t)),
        )
        return
      }

      if (isOptionalType(memberType)) memberType = memberType.type

      if (isArrayType(memberType)) {
        // array of ConfigurationSchemas
        layerModelDefinition[memberName] = types.array(
          ConfigurationLayer(memberType.subType),
        )
      } else if (isMapType(memberType)) {
        // map of id -> ConfigurationSchema
        layerModelDefinition[memberName] = types.map(
          ConfigurationLayer(memberType.subType),
        )
      } else if (isConfigurationSchemaType(memberType)) {
        // single sub-schema
        layerModelDefinition[memberName] = ConfigurationLayer(memberType)
      } else {
        // slot definition
        layerModelDefinition[memberName] = ConfigurationLayerSlot(
          memberName,
          memberType,
          slotDefinition,
        )
      }
    }
  })

  // inspect the parent schema type and make slots with the same type but default-undefined
  return types
    .model(layerModelDefinition)
    .views(self => ({
      get parent() {
        if (self.parentConfigId)
          return resolveIdentifier(
            parentSchemaType,
            getRoot(self),
            self.parentConfigId,
          )
        if (self.parentConfigPath) {
          return resolvePath(self, self.parentConfigPath)
        }

        throw new TypeError(
          'node has neither parentConfigId nor parentConfigPath set',
        )
      },
    }))
    .postProcessSnapshot(snap => {
      if (!snap.parentConfigId) delete snap.parentConfigId
      if (!snap.parentConfigPath) delete snap.parentConfigPath
      return snap
    })
}

export default ConfigurationLayer
