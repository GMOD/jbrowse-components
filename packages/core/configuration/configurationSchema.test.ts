import { types, getSnapshot } from 'mobx-state-tree'
import { ConfigurationSchema } from './configurationSchema'
import { isConfigurationModel } from './util'
import { getConf, readConfObject } from '.'
// import { ConfigurationSchemaForModel, GetOptions, GetBase, ConfigurationSlotName } from './types'

describe('configuration schemas', () => {
  test('can make a schema with a color', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Track', {
        backgroundColor: {
          defaultValue: '#eee',
          description: "the track's background color",
          type: 'color',
        },
        someInteger: {
          defaultValue: 12,
          description: 'an integer slot',
          type: 'integer',
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
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject', {
            someNumber: {
              defaultValue: 4.3,
              description: 'some number in a subconfiguration',
              type: 'number',
            },
          }),
        ),
        someInteger: {
          defaultValue: 12,
          description: 'an integer slot',
          type: 'integer',
        },
      }),
    })

    const model = container.create()
    expect(getConf(model, 'someInteger')).toBe(12)
    // expect(getConf(model, 'myArrayOfSubConfigurations')).toBe(undefined)
  })

  test('can nest a single subconfiguration schema', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        mySubConfiguration: ConfigurationSchema('SubObject', {
          someNumber: {
            defaultValue: 4.3,
            description: 'some number in a subconfiguration',
            type: 'number',
          },
        }),
        someInteger: {
          defaultValue: 12,
          description: 'an integer slot',
          type: 'integer',
        },
      }),
    })

    const model = container.create()
    expect(isConfigurationModel(model.configuration)).toBe(true)
    expect(getConf(model, 'someInteger')).toBe(12)
    // expect(getConf(model, 'mySubConfiguration.someNumber')).toBe(4.3)
  })

  test('a schema can inherit from another base schema', () => {
    const base = ConfigurationSchema('Foo', {
      mySubConfiguration: ConfigurationSchema('SubObject', {
        someNumber: {
          defaultValue: 4.3,
          description: 'some number in a subconfiguration',
          type: 'number',
        },
      }),
      someInteger: {
        defaultValue: 12,
        description: 'an integer slot',
        type: 'integer',
      },
    })

    const child = ConfigurationSchema(
      'Bar',
      {
        anotherInteger: {
          defaultValue: 4,
          type: 'integer',
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
          defaultValue: 12,
          description: 'an integer slot',
          type: 'integer',
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
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject2', {
            someNumber: {
              defaultValue: 3.5,
              description: 'some number in a subconfiguration',
              type: 'number',
            },
          }),
        ),
        mySubConfiguration: ConfigurationSchema('SubObject1', {
          someNumber: {
            defaultValue: 4.3,
            description: 'some number in a subconfiguration',
            type: 'number',
          },
        }),
        someInteger: {
          defaultValue: 12,
          description: 'an integer slot',
          type: 'integer',
        },
      }),
    })

    const model = container.create({
      configuration: {
        myArrayOfSubConfigurations: [{ someNumber: 3.5 }, { someNumber: 11.1 }],
        mySubConfiguration: {},
        someInteger: 42,
      },
    })
    expect(getSnapshot(model)).toEqual({
      configuration: {
        // mySubConfiguration is set to the default, so doesn't appear in snapshot
        myArrayOfSubConfigurations: [{}, { someNumber: 11.1 }],

        someInteger: 42,
      },
    })
  })
  test('can snapshot a nested schema 2', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject2', {
            someNumber: {
              defaultValue: 3.5,
              description: 'some number in a subconfiguration',
              type: 'number',
            },
          }),
        ),
        myConfigurationMap: types.map(
          ConfigurationSchema('MappedConfiguration', {
            mappedValue: {
              defaultValue: 101,
              description: 'something in a mapped configuration',
              type: 'number',
            },
          }),
        ),
        mySubConfiguration: ConfigurationSchema('SubObject1', {
          someNumber: {
            defaultValue: 4.3,
            description: 'some number in a subconfiguration',
            type: 'number',
          },
        }),
        someInteger: {
          defaultValue: 12,
          description: 'an integer slot',
          type: 'integer',
        },
      }),
    })

    const model = container.create({
      configuration: {
        myConfigurationMap: { nog: {} },
        mySubConfiguration: { someNumber: 12 },
        someInteger: 12,
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
        dontRedispatch: {
          defaultValue: ['chromosome', 'region'],
          type: 'stringArray',
        },
        gffGzLocation: {
          defaultValue: {
            locationType: 'UriLocation',
            uri: '/path/to/my.gff.gz',
          },
          type: 'fileLocation',
        },
        index: ConfigurationSchema('Gff3TabixIndex', {
          indexType: {
            defaultValue: 'TBI',
            model: types.enumeration('IndexType', ['TBI', 'CSI']),
            type: 'stringEnum',
          },
          location: {
            defaultValue: {
              locationType: 'UriLocation',
              uri: '/path/to/my.gff.gz.tbi',
            },
            type: 'fileLocation',
          },
        }),
        thisShouldGetInstantiated: {
          defaultValue: 'Not instantiated',
          type: 'string',
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
