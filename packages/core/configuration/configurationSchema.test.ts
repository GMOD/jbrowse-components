import { types, getSnapshot } from 'mobx-state-tree'
import { getConf, readConfObject } from '.'
import { ConfigurationSchema } from './configurationSchema'
import { isConfigurationModel } from './util'
// import { ConfigurationSchemaForModel, GetOptions, GetBase, ConfigurationSlotName } from './types'

describe('configuration schemas', () => {
  test('can make a schema with a color', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Track', {
        backgroundColor: {
          description: "the track's background color",
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

    model.configuration.backgroundColor.set(`jexl:'#'+a`)
    expect(getConf(model, 'backgroundColor', { a: 'zonk' })).toBe('#zonk')
    expect(getConf(model, 'backgroundColor', { a: 'bar' })).toBe('#bar')
    model.configuration.backgroundColor.set('hoog')
    expect(getConf(model, 'backgroundColor', { a: 'zonk' })).toBe('hoog')

    model.configuration.someInteger.set('jexl:5+a')
    expect(getConf(model, 'someInteger', { a: 5 })).toBe(10)
    model.configuration.someInteger.set(42)
    expect(getConf(model, 'someInteger', { a: 5 })).toBe(42)

    // typescript tests
    // const conf = model.configuration
    // let schema: ConfigurationSchemaForModel<typeof conf>
    // let options: GetOptions<typeof schema>
    // let base: GetBase<typeof schema>
    // let slot: ConfigurationSlotName<typeof schema>
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

  test('a schema can inherit from another base schema', () => {
    const base = ConfigurationSchema('Foo', {
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
    })

    const child = ConfigurationSchema(
      'Bar',
      {
        anotherInteger: {
          type: 'integer',
          defaultValue: 4,
        },
      },
      {
        baseConfiguration: base,
      },
    )

    const model = child.create()
    expect(isConfigurationModel(model)).toBe(true)
    expect(readConfObject(model, 'someInteger')).toBe(12)

    // typescript tests
    // const conf = model
    // let schema: ConfigurationSchemaForModel<typeof conf>
    // let options: GetOptions<typeof schema>
    // let baseConf: GetBase<typeof schema>
    // let slot: ConfigurationSlotName<typeof schema>
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

    const model = container.create({ configuration: { someInteger: 42 } })
    expect(getConf(model, 'someInteger')).toEqual(42)
    expect(getSnapshot(model)).toEqual({ configuration: { someInteger: 42 } })
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
      configuration: {
        someInteger: 42,
        mySubConfiguration: {},
        myArrayOfSubConfigurations: [{ someNumber: 3.5 }, { someNumber: 11.1 }],
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        someInteger: 42,
        // mySubConfiguration is set to the default, so doesn't appear in snapshot
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
      configuration: {
        someInteger: 12,
        myConfigurationMap: { nog: {} },
        mySubConfiguration: { someNumber: 12 },
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        myConfigurationMap: { nog: {} },
        mySubConfiguration: { someNumber: 12 },
      },
    })

    expect(getConf(model, ['mySubConfiguration', 'someNumber'])).toEqual(12)
  })

  test('re-check instantiation of slots (issue #797)', () => {
    const configSchema = ConfigurationSchema(
      'Gff3TabixAdapter',
      {
        gffGzLocation: {
          type: 'fileLocation',
          defaultValue: {
            uri: '/path/to/my.gff.gz',
            locationType: 'UriLocation',
          },
        },
        index: ConfigurationSchema('Gff3TabixIndex', {
          indexType: {
            model: types.enumeration('IndexType', ['TBI', 'CSI']),
            type: 'stringEnum',
            defaultValue: 'TBI',
          },
          location: {
            type: 'fileLocation',
            defaultValue: {
              uri: '/path/to/my.gff.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        }),
        dontRedispatch: {
          type: 'stringArray',
          defaultValue: ['chromosome', 'region'],
        },
        thisShouldGetInstantiated: {
          type: 'string',
          defaultValue: 'Not instantiated',
        },
      },
      { explicitlyTyped: true },
    )
    const tester = configSchema.create()
    expect(readConfObject(tester, 'dontRedispatch')[0]).toBe('chromosome')
    expect(readConfObject(tester, 'thisShouldGetInstantiated')).toBe(
      'Not instantiated',
    )
    expect(readConfObject(tester, ['index', 'indexType'])).toBe('TBI')
  })
})
