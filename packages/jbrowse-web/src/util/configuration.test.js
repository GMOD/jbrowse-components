import { types, isType } from 'mobx-state-tree'
import {
  getModelConfig,
  ConfigurationSchema,
  getConf,
  stringToFunction,
  functionRegexp,
} from './configuration'

import ModelFactory from '../RootModelFactory'
import JBrowse from '../JBrowse'
import snap1 from '../../test/root.snap.1.json'

describe('configuration saving', () => {
  const Model = ModelFactory(new JBrowse())
  test('can fetch the config of the whole app', () => {
    const model = Model.create(snap1)
    const config = getModelConfig(model)
    expect(config.views.length).toBe(2)
  })
})

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
})
