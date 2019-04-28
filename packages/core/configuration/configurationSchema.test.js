import { types, getSnapshot } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  isConfigurationModel,
} from './configurationSchema'

import { getConf } from './index'

describe('configuration schemas', () => {
  test('can make a schema with a color', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Track', {
        backgroundColor: {
          description: 'the track\'s background color',
          type: 'color',
          defaultValue: '#eee',
        },
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
      }),
    })

    const model = container.create()
    expect(isConfigurationModel(model.configuration)).toBe(true)
    expect(getConf(model, 'backgroundColor')).toBe('#eee')
    expect(getConf(model, 'someInteger')).toBe(12)

    model.configuration.backgroundColor.set('function(a,b) { return "#"+a}')
    expect(getConf(model, 'backgroundColor', ['zonk'])).toBe('#zonk')
    expect(getConf(model, 'backgroundColor', ['bar'])).toBe('#bar')
    model.configuration.backgroundColor.set('hoog')
    expect(getConf(model, 'backgroundColor', ['zonk'])).toBe('hoog')

    model.configuration.someInteger.set('function(a,b) { return 5+a }')
    expect(getConf(model, 'someInteger', [5])).toBe(10)
    model.configuration.someInteger.set(42)
    expect(getConf(model, 'someInteger', [5])).toBe(42)
  })

  test('can nest an array of configuration schemas', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject', {
            someNumber: {
              description: 'some number in a subconfiguration',
              type: 'number',
              defaultValue: 4.3,
            },
          }),
        ),
      }),
    })

    const model = container.create()
    expect(getConf(model, 'someInteger')).toBe(12)
    // expect(getConf(model, 'myArrayOfSubConfigurations')).toBe(undefined)
  })

  test('can nest a single subconfiguration schema', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        mySubConfiguration: ConfigurationSchema('SubObject', {
          someNumber: {
            description: 'some number in a subconfiguration',
            type: 'number',
            defaultValue: 4.3,
          },
        }),
      }),
    })

    const model = container.create()
    expect(isConfigurationModel(model.configuration)).toBe(true)
    expect(getConf(model, 'someInteger')).toBe(12)
    // expect(getConf(model, 'mySubConfiguration.someNumber')).toBe(4.3)
  })

  test('can snapshot a simple schema', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
      }),
    })

    const model = container.create({
      configuration: { configId: 'fogbat', someInteger: 42 },
    })
    expect(getConf(model, 'someInteger')).toEqual(42)
    expect(getSnapshot(model)).toEqual({
      configuration: { configId: 'fogbat', someInteger: 42 },
    })
    expect(getConf(model, 'someInteger')).toEqual(42)

    const model2 = container.create({
      configuration: { configId: 'one' },
    })
    expect(getSnapshot(model2)).toEqual({
      configuration: { configId: 'one' },
    })
    expect(getConf(model2, 'someInteger')).toEqual(12)
  })
  test('can snapshot a nested schema 1', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        mySubConfiguration: ConfigurationSchema('SubObject1', {
          someNumber: {
            description: 'some number in a subconfiguration',
            type: 'number',
            defaultValue: 4.3,
          },
        }),
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject2', {
            someNumber: {
              description: 'some number in a subconfiguration',
              type: 'number',
              defaultValue: 3.5,
            },
          }),
        ),
      }),
    })

    const model = container.create({
      type: 'Foo',
      configuration: {
        configId: 'one',
        someInteger: 42,
        mySubConfiguration: { configId: 'four' },
        myArrayOfSubConfigurations: [
          { configId: 'two', someNumber: 3.5 },
          { configId: 'three', someNumber: 11.1 },
        ],
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        configId: 'one',
        someInteger: 42,
        mySubConfiguration: { configId: 'four' },
        myArrayOfSubConfigurations: [
          { configId: 'two' },
          { configId: 'three', someNumber: 11.1 },
        ],
      },
    })
  })
  test('can snapshot a nested schema 2', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        myConfigurationMap: types.map(
          ConfigurationSchema('MappedConfiguration', {
            mappedValue: {
              description: 'something in a mapped configuration',
              type: 'number',
              defaultValue: 101,
            },
          }),
        ),
        mySubConfiguration: ConfigurationSchema('SubObject1', {
          someNumber: {
            description: 'some number in a subconfiguration',
            type: 'number',
            defaultValue: 4.3,
          },
        }),
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject2', {
            someNumber: {
              description: 'some number in a subconfiguration',
              type: 'number',
              defaultValue: 3.5,
            },
          }),
        ),
      }),
    })

    const model = container.create({
      type: 'Foo',
      configuration: {
        configId: 'two',
        someInteger: 12,
        myConfigurationMap: {
          nog: { configId: 'nog' },
        },
        mySubConfiguration: { configId: 'one', someNumber: 12 },
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        configId: 'two',
        myConfigurationMap: { nog: { configId: 'nog' } },
        mySubConfiguration: { configId: 'one', someNumber: 12 },
      },
    })

    expect(getConf(model, ['mySubConfiguration', 'someNumber'])).toEqual(12)
  })
})
