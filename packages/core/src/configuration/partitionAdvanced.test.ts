import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { partitionAdvanced } from './partitionAdvanced.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const Index = ConfigurationSchema('Index', {
  location: { type: 'string', defaultValue: '' },
  chunkSize: { type: 'number', defaultValue: 1, advanced: true },
})
const Adapter = ConfigurationSchema(
  'Adapter',
  {
    gffLocation: { type: 'string', defaultValue: '' },
    index: Index,
    transform: {
      type: 'frozen',
      defaultValue: {},
      contextVariable: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
const Track = ConfigurationSchema(
  'Track',
  {
    name: { type: 'string', defaultValue: '' },
    adapter: Adapter,
    tuning: { type: 'number', defaultValue: 1, advanced: true },
  },
  { explicitIdentifier: 'trackId' },
)

function split(snapshot: Parameters<typeof Track.create>[0]) {
  const node = Track.create(snapshot, { pluginManager })
  return partitionAdvanced(node, JSON.parse(JSON.stringify(node)))
}

test('routes top-level slots by flag and keeps the identifier with the rest', () => {
  const { rest, advanced } = split({ trackId: 't', name: 'n', tuning: 5 })
  expect(rest.trackId).toBe('t')
  expect(rest.name).toBe('n')
  expect(advanced).toEqual({ tuning: 5 })
})

test('splits a sub-schema member by member, through a nested one', () => {
  const { rest, advanced } = split({
    trackId: 't',
    adapter: {
      type: 'Adapter',
      gffLocation: 'a.gff',
      transform: 'jexl:{x:1}',
      index: { location: 'a.csi', chunkSize: 9 },
    },
  })
  expect(rest.adapter).toEqual({
    type: 'Adapter',
    gffLocation: 'a.gff',
    index: { location: 'a.csi' },
  })
  expect(advanced.adapter).toEqual({
    transform: 'jexl:{x:1}',
    index: { chunkSize: 9 },
  })
})

test('holds no empty sub-object on a side nothing landed on', () => {
  const { advanced } = split({
    trackId: 't',
    adapter: { type: 'Adapter', gffLocation: 'a.gff' },
  })
  expect(advanced.adapter).toBeUndefined()
})
