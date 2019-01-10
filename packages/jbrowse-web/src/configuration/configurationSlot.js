import { types } from 'mobx-state-tree'
import { FileLocation } from '../mst-types'
import { stringToFunction } from '../util/functionStrings'

function isValidColorString(/* str */) {
  // TODO: check all the crazy cases for whether it's a valid HTML/CSS color string
  return true
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
    removeAtIndex(idx) {
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

export default function ConfigSlot(
  slotName,
  { description = '', model, type, defaultValue },
) {
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
        if (self.isCallback) {
          // compile this as a function
          return stringToFunction(String(self.value))
        }
        return () => self.value
      },
      get isCallback() {
        return /^\s*function\s*\(/.test(self.value)
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
      convertToCallback() {
        if (self.isCallback) return
        // TODO: implement proper stringification of all the different
        // config slot types
        const valString =
          self.value && self.value.toJSON
            ? self.value.toJSON()
            : `'${self.value}'`
        self.value = `function() {
  return ${valString}
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
