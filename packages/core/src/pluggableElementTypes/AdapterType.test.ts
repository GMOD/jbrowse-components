import { ConfigurationSchema } from '../configuration/index.ts'
import AdapterType from './AdapterType.ts'

// `normalizeSnapshot` used to be a second registration beside the config
// schema's `preProcessSnapshot`, and an adapter that declared only the schema
// half looked entirely fine: loading its config from a URL goes through MST, so
// the shorthand expands. `normalizeAdapterSnapshots` is the one caller that
// reads the AdapterType instead, so what broke was `localFiles` in the embedded
// products, silently — five in-tree adapters were in that state.
const shorthand = (snap: Record<string, unknown>) =>
  snap.uri
    ? { ...snap, myLocation: { uri: snap.uri, baseUri: snap.baseUri } }
    : snap

const withPreProcess = ConfigurationSchema(
  'WithPreProcess',
  { myLocation: { type: 'fileLocation', defaultValue: { uri: '/my.txt' } } },
  { explicitlyTyped: true, preProcessSnapshot: shorthand },
)

const AdapterClass = class {} as any

test('normalizeSnapshot falls back to the schema preProcessSnapshot', () => {
  const type = new AdapterType({
    name: 'WithPreProcess',
    configSchema: withPreProcess,
    AdapterClass,
  })

  expect(
    type.normalizeSnapshot?.({ type: 'WithPreProcess', uri: 'x.txt' }),
  ).toEqual({
    type: 'WithPreProcess',
    uri: 'x.txt',
    myLocation: { uri: 'x.txt', baseUri: undefined },
  })
})

test('an explicit normalizeSnapshot wins over the schema one', () => {
  const type = new AdapterType({
    name: 'WithPreProcess',
    configSchema: withPreProcess,
    AdapterClass,
    normalizeSnapshot: snap => ({ ...snap, mine: true }),
  })

  expect(
    type.normalizeSnapshot?.({ type: 'WithPreProcess', uri: 'x.txt' }),
  ).toEqual({
    type: 'WithPreProcess',
    uri: 'x.txt',
    mine: true,
  })
})

test('a schema with no preProcessSnapshot leaves it undefined', () => {
  const type = new AdapterType({
    name: 'Plain',
    configSchema: ConfigurationSchema('Plain', {}, { explicitlyTyped: true }),
    AdapterClass,
  })

  expect(type.normalizeSnapshot).toBeUndefined()
})
