import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { makeSlotFacade } from './slotFacade.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const create = (schema: ReturnType<typeof ConfigurationSchema>) =>
  schema.create(undefined, { pluginManager })

test('facade exposes metadata + a live value getter driven by set()', () => {
  const schema = ConfigurationSchema('Test', {
    color: {
      type: 'color',
      defaultValue: 'red',
      description: 'the color',
      contextVariable: ['feature'],
    },
  })
  const node = create(schema)
  const facade = makeSlotFacade(node, 'color')

  expect(facade.name).toBe('color')
  expect(facade.type).toBe('color')
  expect(facade.description).toBe('the color')
  expect(facade.defaultValue).toBe('red')
  expect(facade.contextVariable).toEqual(['feature'])
  expect(facade.pluginManager).toBe(pluginManager)
  expect(facade.value).toBe('red')

  facade.set('green')
  expect(facade.value).toBe('green')
  expect(node.color).toBe('green')
})

test('facade derives stringEnum choices from the metadata model', () => {
  const schema = ConfigurationSchema('Test', {
    mode: {
      type: 'stringEnum',
      model: types.enumeration('Mode', ['a', 'b', 'c']),
      defaultValue: 'a',
    },
  })
  const facade = makeSlotFacade(create(schema), 'mode')
  expect(facade.choices).toEqual(['a', 'b', 'c'])
})

test('facade finds slots inherited via baseConfiguration', () => {
  const base = ConfigurationSchema('Base', {
    shared: { type: 'string', defaultValue: 'inherited' },
  })
  const schema = ConfigurationSchema(
    'Child',
    { own: { type: 'number', defaultValue: 1 } },
    { baseConfiguration: base },
  )
  const node = create(schema)
  expect(makeSlotFacade(node, 'shared').value).toBe('inherited')
  expect(makeSlotFacade(node, 'own').value).toBe(1)
})

test('facade set replaces an array slot value wholesale', () => {
  const schema = ConfigurationSchema('Test', {
    list: { type: 'stringArray', defaultValue: ['a', 'b'] },
  })
  const node = create(schema)
  const facade = makeSlotFacade(node, 'list')

  expect([...(facade.value as string[])]).toEqual(['a', 'b'])
  facade.set(['z', 'c'])
  expect([...node.list]).toEqual(['z', 'c'])
})
