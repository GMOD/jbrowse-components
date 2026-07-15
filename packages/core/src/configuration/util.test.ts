import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import {
  getTypeNamesFromExplicitlyTypedUnion,
  isBareConfigurationSchemaType,
  isConfigurationModel,
  isConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
} from './util.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

describe('getTypeNamesFromExplicitlyTypedUnion', () => {
  test('regular config schemas', () => {
    const one = ConfigurationSchema('One', {}, { explicitlyTyped: true })
    const two = ConfigurationSchema('Two', {}, { explicitlyTyped: true })
    const u = types.union(one, two)

    const names = getTypeNamesFromExplicitlyTypedUnion(u)
    expect(names).toEqual(['One', 'Two'])
  })
  test('late config schemas', () => {
    const one = ConfigurationSchema('One', {}, { explicitlyTyped: true })
    const two = types.late(() =>
      ConfigurationSchema('Two', {}, { explicitlyTyped: true }),
    )
    const u = types.union(one, two)

    const names = getTypeNamesFromExplicitlyTypedUnion(u)
    expect(names).toEqual(['One', 'Two'])
  })
})

// These four predicates are the single source of truth for classifying a
// configuration schema definition entry (constant vs slot vs sub-schema) and
// for recognizing schema types/instances. Exercise them directly.
describe('schema definition entry classification', () => {
  const schema = ConfigurationSchema('Sample', {
    color: { type: 'color', defaultValue: 'red' },
  })

  describe('isConstantEntry', () => {
    test.each([
      ['a string', 'hello', true],
      ['a number', 42, true],
      ['a slot definition', { type: 'string', defaultValue: '' }, false],
      ['a schema type', schema, false],
      ['undefined', undefined, false],
    ])('%s', (_label, value, expected) => {
      expect(isConstantEntry(value)).toBe(expected)
    })
  })

  describe('isSlotDefinitionEntry', () => {
    test.each([
      ['a slot definition', { type: 'string', defaultValue: '' }, true],
      ['a string constant', 'hello', false],
      ['an object without type', { defaultValue: 1 }, false],
      ['null', null, false],
      // a schema type is an MST type (isType), not a plain slot-def object,
      // even though it happens to expose a `type` property
      ['a schema type', schema, false],
    ])('%s', (_label, value, expected) => {
      expect(isSlotDefinitionEntry(value)).toBe(expected)
    })
  })

  describe('isConfigurationSchemaType / isBareConfigurationSchemaType', () => {
    test('a bare schema type is recognized', () => {
      expect(isBareConfigurationSchemaType(schema)).toBe(true)
      expect(isConfigurationSchemaType(schema)).toBe(true)
    })

    test('a late-wrapped schema type is recognized', () => {
      const late = types.late(() => schema)
      expect(isBareConfigurationSchemaType(late)).toBe(true)
      expect(isConfigurationSchemaType(late)).toBe(true)
    })

    test('arrays/maps/optionals of schemas are schema types', () => {
      expect(isConfigurationSchemaType(types.array(schema))).toBe(true)
      expect(isConfigurationSchemaType(types.map(schema))).toBe(true)
      expect(isConfigurationSchemaType(types.optional(schema, {}))).toBe(true)
    })

    test('a union of schemas (optionally with undefined) is a schema type', () => {
      const other = ConfigurationSchema('Other', {})
      expect(isConfigurationSchemaType(types.union(schema, other))).toBe(true)
    })

    test('plain MST types are not schema types', () => {
      expect(isBareConfigurationSchemaType(types.string)).toBe(false)
      expect(isConfigurationSchemaType(types.string)).toBe(false)
      expect(isConfigurationSchemaType(types.array(types.number))).toBe(false)
    })

    test('non-types are not schema types', () => {
      expect(isConfigurationSchemaType('Sample')).toBe(false)
      expect(isBareConfigurationSchemaType(undefined)).toBe(false)
    })
  })

  describe('isConfigurationModel', () => {
    test('a created schema instance is a configuration model', () => {
      const node = schema.create(undefined, { pluginManager })
      expect(isConfigurationModel(node)).toBe(true)
    })

    test('the schema type itself is not a model (it is a type)', () => {
      expect(isConfigurationModel(schema)).toBe(false)
    })

    test('plain objects and primitives are not configuration models', () => {
      expect(isConfigurationModel({ color: 'red' })).toBe(false)
      expect(isConfigurationModel('red')).toBe(false)
      expect(isConfigurationModel(undefined)).toBe(false)
    })
  })
})
