/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, IAnyModelType, IAnyComplexType } from 'mobx-state-tree'
import { stringToJexlExpression } from '../util/jexlStrings'
import { FileLocation } from '../util/types/mst'
import { getEnv } from '../util'

function isValidColorString(/* str */) {
  // TODO: check all the crazy cases for whether it's a valid HTML/CSS color string
  return true
}
const typeModels: Record<string, any> = {
  boolean: types.boolean,
  color: types.refinement('Color', types.string, isValidColorString),
  fileLocation: FileLocation,
  frozen: types.frozen(),
  integer: types.integer,
  number: types.number,
  numberMap: types.map(types.number),
  string: types.string,
  stringArray: types.array(types.string),
  stringArrayMap: types.map(types.array(types.string)),
  text: types.string,
}

// default values we use if the defaultValue is malformed or does not work
const fallbackDefaults: Record<string, any> = {
  boolean: true,
  color: 'black',
  fileLocation: { locationType: 'UriLocation', uri: '/path/to/resource.txt' },
  frozen: {},
  integer: 1,
  number: 1,
  numberMap: {},
  string: '',
  stringArray: [],
  stringArrayMap: {},
  text: '',
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
const typeModelExtensions: Record<string, (self: any) => any> = {
  boolean: literalJSON,
  fileLocation: objectJSON,
  frozen: objectJSON,
  integer: literalJSON,
  number: literalJSON,

  numberMap: (self: { value: Map<string, number> }) => ({
    actions: {
      add(key: string, val: number) {
        self.value.set(key, val)
      },
      remove(key: string) {
        self.value.delete(key)
      },
    },
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
  }),
  // special actions for working with stringArray slots
  stringArray: (self: { value: string[] }) => ({
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
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
  }),
  stringArrayMap: (self: { value: Map<string, string[]> }) => ({
    actions: {
      add(key: string, val: any) {
        self.value.set(key, val)
      },
      addToKey(key: string, val: string) {
        const ar = self.value.get(key)
        if (!ar) {
          throw new Error(`${key} not found`)
        }
        ar.push(val)
      },
      remove(key: string) {
        self.value.delete(key)
      },
      removeAtKeyIndex(key: string, idx: number) {
        const ar = self.value.get(key)
        if (!ar) {
          throw new Error(`${key} not found`)
        }
        ar.splice(idx, 1)
      },
      setAtKeyIndex(key: string, idx: number, val: string) {
        const ar = self.value.get(key)
        if (!ar) {
          throw new Error(`${key} not found`)
        }
        ar[idx] = val
      },
    },
    views: {
      get valueJSON() {
        return JSON.stringify(self.value)
      },
    },
  }),
}

// const FunctionStringType = types.refinement(
//   'FunctionString',
//   types.string,
//   str => functionRegexp.test(str),
// )

const JexlStringType = types.refinement('JexlString', types.string, str =>
  str.startsWith('jexl:'),
)
function json(value: any) {
  return value?.toJSON ? value.toJSON() : `"${value}"`
}
export interface ConfigSlotDefinition {
  /** human-readable description of the slot's meaning */
  description?: string
  /** custom base MST model for the slot's value */
  model?: IAnyModelType | IAnyComplexType
  /** name of the type of slot, e.g. "string", "number", "stringArray" */
  type: string
  /** default value of the slot */
  defaultValue: any
  /** parameter names of the function callback */
  contextVariable?: string[]
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
    contextVariable = [],
  }: ConfigSlotDefinition,
) {
  if (!type) {
    throw new Error('type name required')
  }
  if (!model) {
    model = typeModels[type]
  }
  if (!model) {
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )
  }

  if (defaultValue === undefined) {
    throw new Error("no 'defaultValue' provided")
  }

  // if the `type` is something like `color`, then the model name
  // here will be `ColorConfigSlot`
  const configSlotModelName = `${slotName
    .charAt(0)
    .toUpperCase()}${slotName.slice(1)}ConfigSlot`
  let slot = types
    .model(configSlotModelName, {
      description: types.literal(description),
      name: types.literal(slotName),
      type: types.literal(type),
      value: types.optional(types.union(JexlStringType, model), defaultValue),
    })
    .volatile(() => ({
      contextVariable,
    }))
    .views(self => ({
      get isCallback() {
        return String(self.value).startsWith('jexl:')
      },
    }))
    .views(self => ({
      get expr() {
        if (self.isCallback) {
          // compile as jexl function
          const { pluginManager } = getEnv(self)
          if (!pluginManager && typeof jest === 'undefined') {
            console.warn(
              'no pluginManager detected on config env (if you dynamically instantiate a config, for example in renderProps for your display model, check that you add the env argument)',
            )
          }
          return stringToJexlExpression(String(self.value), pluginManager?.jexl)
        }
        return { evalSync: () => self.value }
      },

      // JS representation of the value of this slot, suitable
      // for embedding in either JSON or a JS function string.
      // many of the data types override this in typeModelExtensions
      get valueJSON(): any[] | Record<string, any> | string | undefined {
        if (self.isCallback) {
          return undefined
        }

        return json(self.value)
      },
    }))
    .preProcessSnapshot(val =>
      typeof val === 'object' && val.name === slotName
        ? val
        : {
            description,
            name: slotName,
            type,
            value: val,
          },
    )
    .postProcessSnapshot(snap => {
      if (typeof snap.value === 'object') {
        return JSON.stringify(snap.value) !== JSON.stringify(defaultValue)
          ? snap.value
          : undefined
      }
      return snap.value !== defaultValue ? snap.value : undefined
    })
    .actions(self => ({
      convertToCallback() {
        if (self.isCallback) {
          return
        }
        self.value = `jexl:${self.valueJSON || "''"}`
      },
      convertToValue() {
        if (!self.isCallback) {
          return
        }
        // try calling it with no arguments
        try {
          const funcResult = self.expr.evalSync()
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

        // if defaultValue has jexl: string, run this part
        if (self.isCallback) {
          if (!(type in fallbackDefaults)) {
            throw new Error(`no fallbackDefault defined for type ${type}`)
          }
          self.value = fallbackDefaults[type]
        }
      },
      reset() {
        self.value = defaultValue
      },
      set(newVal: any) {
        self.value = newVal
      },
    }))

  // if there are any type-specific extensions (views or actions)
  //  to the slot, add those in
  if (typeModelExtensions[type]) {
    slot = slot.extend(typeModelExtensions[type])
  }

  const completeModel = types.optional(slot, {
    description,
    name: slotName,
    type,
    value: defaultValue,
  })
  const m = completeModel
  Object.defineProperty(m, 'isJBrowseConfigurationSlot', { value: true })
  return m
}
