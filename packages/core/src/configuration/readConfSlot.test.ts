import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { FormatAboutConfigSchemaFactory } from './formatAboutConfigSchema.ts'
import { readConfSlot } from './readConfObject.ts'

// real PluginManager provides the jexl instance used by callback config slots
const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

// the shipped schema, the same one a track and the root config both carry
const TrackConf = ConfigurationSchema(
  'TestTrack',
  {
    name: { type: 'string', defaultValue: '' },
    formatAbout: FormatAboutConfigSchemaFactory(),
  },
  { explicitIdentifier: 'trackId' },
)

test('walks a path on a plain object', () => {
  expect(readConfSlot({ foo: { bar: 5 } }, ['foo', 'bar'])).toBe(5)
})

test('evaluates a jexl string on a plain object', () => {
  expect(readConfSlot({ foo: 'jexl:1+2' }, 'foo', {}, pluginManager.jexl)).toBe(
    3,
  )
})

test('passes context args to a jexl string on a plain object', () => {
  expect(
    readConfSlot(
      { foo: 'jexl:config.name' },
      'foo',
      { config: { name: 'hello' } },
      pluginManager.jexl,
    ),
  ).toBe('hello')
})

test('returns an empty jexl body literally instead of throwing', () => {
  expect(readConfSlot({ foo: 'jexl:' }, 'foo', {}, pluginManager.jexl)).toBe(
    'jexl:',
  )
})

test('throws on a plain-object callback slot with no jexl instance', () => {
  expect(() => readConfSlot({ foo: 'jexl:1+2' }, 'foo')).toThrow(
    /no jexl instance provided/,
  )
})

test('reads a slot from a state tree node', () => {
  const config = TrackConf.create(
    { trackId: 't1', name: 'Track 1' },
    { pluginManager },
  )
  expect(readConfSlot(config, 'name')).toBe('Track 1')
})

test('passes context args to a callback slot on a state tree node', () => {
  const config = TrackConf.create(
    {
      trackId: 't1',
      name: 'Track 1',
      formatAbout: { config: "jexl:{'Computed': config.name}" },
    },
    { pluginManager },
  )
  expect(
    readConfSlot(config, ['formatAbout', 'config'], {
      config: { name: 'Track 1' },
    }),
  ).toEqual({ Computed: 'Track 1' })
})
