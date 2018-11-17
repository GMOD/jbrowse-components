import { types, getSnapshot } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  stringToFunction,
  functionRegexp,
} from './configurationSchema'

import { getConf } from './index'

describe('function string parsing', () => {
  it('has working regex', () => {
    const result = functionRegexp.exec('function(a,b,c) { return a+b+c+5}')
    expect(result).toBeTruthy()
    const [, paramList, remainder] = result
    expect(paramList).toEqual('a,b,c')
    expect(remainder).toEqual(' return a+b+c+5}')
  })
  it('has working regex 2', () => {
    const result = functionRegexp.exec('function( a, b,c){\nreturn a+b+c+5 }')
    expect(result).toBeTruthy()
    const [, paramList, remainder] = result
    expect(paramList).toEqual(' a, b,c')
    expect(remainder).toEqual('\nreturn a+b+c+5 }')
  })
  ;[
    'function(a,b,c) { return a+b+c+5}',
    'function(a, b,c){return a+b+c+5 }',
    'function( a, b,c){\nreturn a+b+c+5 }',
    '  function( a, b,c){\nreturn a+b+c+5 } ',
    '  function( a, b,c){\nreturn a+b+c+5; ;}',
    '  function( a, b,c){\nreturn a+b+c+5; \n ;\n}',
  ].forEach(funcStr => {
    it(`can parse '${funcStr}'`, () => {
      const func = stringToFunction(funcStr)
      expect(func(5, 10, 15)).toBe(35)
    })
  })
})

describe('configuration schemas', () => {
  test('can make a schema with a color', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Track', {
        backgroundColor: {
          description: `the track's background color`,
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
    expect(getConf(model, 'backgroundColor')).toBe('#eee')
    expect(getConf(model, 'someInteger')).toBe(12)

    model.configuration.backgroundColor.set('function(a,b) { return "#"+a}')
    expect(getConf(model, 'backgroundColor', ['zonk'])).toBe('#zonk')
    expect(getConf(model, 'backgroundColor', 'bar')).toBe('#bar')
    model.configuration.backgroundColor.set('hoog')
    expect(getConf(model, 'backgroundColor', ['zonk'])).toBe('hoog')

    model.configuration.someInteger.set('function(a,b) { return 5+a }')
    expect(getConf(model, 'someInteger', 5)).toBe(10)
    model.configuration.someInteger.set(42)
    expect(getConf(model, 'someInteger', 5)).toBe(42)
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
      configuration: { someInteger: 42 },
    })
    expect(getConf(model, 'someInteger')).toEqual(42)
    expect(getSnapshot(model)).toEqual({
      configuration: { someInteger: 42 },
    })
    expect(getConf(model, 'someInteger')).toEqual(42)

    const model2 = container.create({ configuration: {} })
    expect(getSnapshot(model2)).toEqual({ configuration: {} })
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
        someInteger: 42,
        myArrayOfSubConfigurations: [{ someNumber: 3.5 }, { someNumber: 11.1 }],
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        someInteger: 42,
        myArrayOfSubConfigurations: [{}, { someNumber: 11.1 }],
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
        someInteger: 12,
        mySubConfiguration: { someNumber: 12 },
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        mySubConfiguration: { someNumber: 12 },
      },
    })
  })
})
