/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, IAnyModelType, IAnyComplexType } from 'mobx-state-tree'
import { stringToFunction, functionRegexp } from '../util/functionStrings'
import { inDevelopment } from '../util'
import { FileLocation } from '../util/types/mst'

function isValidColorString(/* str */) {
  // TODO: check all the crazy cases for whether it's a valid HTML/CSS color string
  return true
}
const typeModels: { [typeName: string]: any } = {
  stringArray: types.array(types.string),
  stringArrayMap: types.map(types.array(types.string)),
  numberMap: types.map(types.number),
  boolean: types.boolean,
  color: types.refinement('Color', types.string, isValidColorString),
  integer: types.integer,
  number: types.number,
  string: types.string,
  text: types.string,
  fileLocation: FileLocation,
  frozen: types.frozen(),
}

// default values we use if the defaultValue is malformed or does not work
const fallbackDefaults: { [typeName: string]: any } = {
  stringArray: [],
  stringArrayMap: {},
  numberMap: {},
  boolean: true,
  color: 'black',
  integer: 1,
  number: 1,
  string: '',
  text: '',
  fileLocation: { uri: '/path/to/resource.txt' },
  frozen: {},
}

const literalJSON = (self: { value: any }) => ({
  views: {
    get valueJSON() {
      return self.value
    },
  },
})

const objectJSON = (self: { value: any }) => ({
  views: {
    get valueJSON() {
      return JSON.stringify(self.value)
    },
  },
})

// custom actions for modifying the value models
const typeModelExtensions: { [typeName: string]: (self: any) => any } = {
  fileLocation: objectJSON,
  number: literalJSON,
  integer: literalJSON,
  boolean: literalJSON,
  frozen: objectJSON,
  // special actions for working with stringArray slots
  stringArray: (self: { value: string[] }) => ({
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
    actions: {
      add(val: string) {
        self.value.push(val)
      },
      removeAtIndex(idx: number) {
        self.value.splice(idx, 1)
      },
      setAtIndex(idx: number, val: string) {
        self.value[idx] = val
      },
    },
  }),
  stringArrayMap: (self: { value: Map<string, string[]> }) => ({
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
    actions: {
      add(key: string, val: any) {
        self.value.set(key, val)
      },
      remove(key: string) {
        self.value.delete(key)
      },
      addToKey(key: string, val: string) {
        const ar = self.value.get(key)
        if (!ar) throw new Error(`${key} not found`)
        ar.push(val)
      },
      removeAtKeyIndex(key: string, idx: number) {
        const ar = self.value.get(key)
        if (!ar) throw new Error(`${key} not found`)
        ar.splice(idx, 1)
      },
      setAtKeyIndex(key: string, idx: number, val: string) {
        const ar = self.value.get(key)
        if (!ar) throw new Error(`${key} not found`)
        ar[idx] = val
      },
    },
  }),
  numberMap: (self: { value: Map<string, number> }) => ({
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
    actions: {
      add(key: string, val: number) {
        self.value.set(key, val)
      },
      remove(key: string, val: number) {
        self.value.delete(key)
      },
    },
  }),
}

const FunctionStringType = types.refinement(
  'FunctionString',
  types.string,
  str => functionRegexp.test(str),
)

export interface ConfigSlotDefinition {
  description?: string
  /** custom base MST model for the slot's value */
  model?: IAnyModelType | IAnyComplexType
  /** name of the type of slot, e.g. "string", "number", "stringArray" */
  type: string
  /** default value of the slot */
  defaultValue: any
  /** parameter names of the function callback */
  functionSignature?: string[]
}

/**
 * builds a MST model for a configuration slot
 *
 * @param slotName -
 * @param  definition -
 */
export default function ConfigSlot(
  slotName: string,
  {
    description = '',
    model,
    type,
    defaultValue,
    functionSignature = [],
  }: ConfigSlotDefinition,
) {
  if (!type) throw new Error('type name required')
  if (!model) model = typeModels[type]
  if (!model) {
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )
  }

  if (defaultValue === undefined) throw new Error("no 'defaultValue' provided")

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
      get isCallback() {
        return /^\s*function\s*\(/.test(String(self.value))
      },
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

      // JS representation of the value of this slot, suitable
      // for embedding in either JSON or a JS function string.
      // many of the data types override this in typeModelExtensions
      get valueJSON(): any[] | Record<string, any> | string | undefined {
        if (self.isCallback) return undefined
        function json(value: { toJSON: Function } | any) {
          if (value && value.toJSON) {
            return value.toJSON()
          }
          return `'${value}'`
        }
        return json(self.value)
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
    .postProcessSnapshot(snap => {
      if (typeof snap.value === 'object')
        return JSON.stringify(snap.value) !== JSON.stringify(defaultValue)
          ? snap.value
          : undefined
      return snap.value !== defaultValue ? snap.value : undefined
    })
    .actions(self => ({
      set(newVal: any) {
        self.value = newVal
      },
      reset() {
        self.value = defaultValue
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
          if (!(type in fallbackDefaults)) {
            throw new Error(`no fallbackDefault defined for type ${type}`)
          }
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
  type GeneratedConfigSlot = typeof completeModel
  interface ConfigurationSlot extends GeneratedConfigSlot {
    isJBrowseConfigurationSlot?: boolean
  }
  const m: ConfigurationSlot = completeModel
  m.isJBrowseConfigurationSlot = true
  return m
}
