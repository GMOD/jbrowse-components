import { types } from 'mobx-state-tree'
import { FileLocation } from '../mst-types'
import { stringToFunction, functionRegexp } from '../util/functionStrings'
import { inDevelopment } from '../util'

function isValidColorString(/* str */) {
  // TODO: check all the crazy cases for whether it's a valid HTML/CSS color string
  return true
}
const typeModels = {
  stringArray: types.array(types.string),
  stringArrayMap: types.map(types.array(types.string)),
  boolean: types.boolean,
  color: types.refinement('Color', types.string, isValidColorString),
  integer: types.integer,
  number: types.number,
  string: types.string,
  fileLocation: FileLocation,
}

// default values we use if the defaultValue is malformed or does not work
const fallbackDefaults = {
  stringArray: [],
  boolean: true,
  color: 'black',
  integer: 1,
  number: 1,
  string: '',
  fileLocation: { uri: '/path/to/resource.txt' },
}

const literalJSON = self => ({
  views: {
    get valueJSON() {
      return self.value
    },
  },
})

// custom actions for modifying the value models
const typeModelExtensions = {
  fileLocation: self => ({
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
  }),
  number: literalJSON,
  integer: literalJSON,
  boolean: literalJSON,
  // special actions for working with stringArray slots
  stringArray: self => ({
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
    actions: {
      add(val) {
        self.value.push(val)
      },
      removeAtIndex(idx) {
        self.value.splice(idx, 1)
      },
      setAtIndex(idx, val) {
        self.value[idx] = val
      },
    },
  }),
  stringArrayMap: self => ({
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
    actions: {
      add(key, val) {
        self.value.set(key, val)
      },
      remove(key) {
        self.value.delete(key)
      },
      addToKey(key, val) {
        self.value.get(key).push(val)
      },
      removeAtKeyIndex(key, idx) {
        self.value.get(key).splice(idx, 1)
      },
      setAtKeyIndex(key, idx, val) {
        self.value.get(key)[idx] = val
      },
    },
  }),
}

const FunctionStringType = types.refinement(
  'FunctionString',
  types.string,
  str => functionRegexp.test(str),
)

/**
 * builds a MST model for a configuration slot
 *
 * @param {*} slotName
 * @param {object} param1
 * @param {string} param1.description?
 * @param {object} param1.model? custom base MST model for the slot's value
 * @param {string} type name of the type of slot, e.g. "string", "number", "stringArray"
 * @param {*} defaultValue default value of the slot
 */
export default function ConfigSlot(
  slotName,
  { description = '', model, type, defaultValue, functionSignature = [] },
) {
  if (!type) throw new Error('type name required')
  if (!model) model = typeModels[type]
  if (!model)
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )

  if (defaultValue === undefined) throw new Error(`no 'defaultValue' provided`)

  // if the `type` is something like `color`, then the model name
  // here will be `ColorConfigSlot`
  const configSlotModelName = `${slotName
    .charAt(0)
    .toUpperCase()}${slotName.slice(1)}ConfigSlot`
  let slot = types
    .model(configSlotModelName, {
      name: types.literal(slotName),
      description: types.literal(description),
      type: types.literal(type),
      value: types.optional(
        types.union(FunctionStringType, model),
        defaultValue,
      ),
    })
    .volatile(() => ({
      functionSignature,
    }))
    .views(self => ({
      get func() {
        if (self.isCallback) {
          // compile this as a function
          return stringToFunction(String(self.value), {
            verifyFunctionSignature: inDevelopment
              ? functionSignature
              : undefined,
          })
        }
        return () => self.value
      },
      get isCallback() {
        return /^\s*function\s*\(/.test(self.value)
      },

      // JS representation of the value of this slot, suitable
      // for embedding in either JSON or a JS function string.
      // many of the data types override this in typeModelExtensions
      get valueJSON() {
        if (self.isCallback) return undefined
        return self.value && self.value.toJSON
          ? self.value.toJSON()
          : `'${self.value}'`
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
      set(newVal) {
        self.value = newVal
      },
      convertToCallback() {
        if (self.isCallback) return
        self.value = `function(${self.functionSignature.join(', ')}) {
  return ${self.valueJSON}
}
`
      },
      convertToValue() {
        if (!self.isCallback) return
        // try calling it with no arguments
        try {
          const funcResult = self.func()
          if (funcResult !== undefined) {
            self.value = funcResult
            return
          }
        } catch (e) {
          /* ignore */
        }
        self.value = defaultValue
        // if it is still a callback (happens if the defaultValue is a callback),
        // then use the last-resort fallback default
        if (self.isCallback) {
          if (!(type in fallbackDefaults))
            throw new Error(`no fallbackDefault defined for type ${type}`)
          self.value = fallbackDefaults[type]
        }
      },
    }))

  // if there are any type-specific extensions (views or actions)
  //  to the slot, add those in
  if (typeModelExtensions[type]) {
    slot = slot.extend(typeModelExtensions[type])
  }

  const completeModel = types.optional(slot, {
    name: slotName,
    type,
    description,
    value: defaultValue,
  })
  completeModel.isJBrowseConfigurationSlot = true
  return completeModel
}
