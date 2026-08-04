import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { createStopToken } from '@jbrowse/core/util/stopToken'

import { makeMateDiscovery } from './discoverMates.ts'

import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'

const schema = ConfigurationSchema(
  'SyntenyTrack',
  {
    assemblyNames: { type: 'stringArray', defaultValue: [] },
    adapter: { type: 'frozen', defaultValue: {} },
  },
  { explicitIdentifier: 'trackId', explicitlyTyped: true },
)

const region: Region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 100,
  end: 200,
}

function feature(mateAssembly: string) {
  return new SimpleFeature({
    uniqueId: mateAssembly,
    refName: 'ctgA',
    start: 100,
    end: 200,
    mate: { refName: 'ctgB', start: 0, end: 100, assemblyName: mateAssembly },
  })
}

function setup(features: Feature[]) {
  const calls: {
    sessionId: string
    method: string
    args: Record<string, unknown>
  }[] = []
  const session = {
    rpcManager: {
      call: (
        sessionId: string,
        method: string,
        args: Record<string, unknown>,
      ) => {
        calls.push({ sessionId, method, args })
        return Promise.resolve(features)
      },
    },
  } as unknown as AbstractSessionModel
  const track = schema.create({
    trackId: 't1',
    assemblyNames: ['volvox', 'volvox_ins'],
    adapter: { type: 'PAFAdapter', uri: 'x.paf' },
  })
  return { discover: makeMateDiscovery({ session, track, region }), calls }
}

// The wiring the dialog's cancel depends on: a token it creates is worthless
// unless it rides along to the worker, where the download+parse checks it.
test('the stop token and the region reach the RPC', async () => {
  const { discover, calls } = setup([feature('volvox_ins')])
  const stopToken = createStopToken()
  await discover(stopToken)

  expect(calls.length).toBe(1)
  const { sessionId, method, args } = calls[0]!
  expect(sessionId).toBe('t1')
  expect(method).toBe('CoreGetFeatures')
  expect(args.stopToken).toBe(stopToken)
  expect(args.regions).toEqual([region])
  expect(args.adapterConfig).toEqual({ type: 'PAFAdapter', uri: 'x.paf' })
})

test('what comes back is reduced to one panel per declared mate assembly', async () => {
  const { discover } = setup([
    feature('volvox_ins'),
    // not a declared assembly of the track: a one-vs-all PanSN sample label
    feature('HG002#1'),
  ])
  const { mates, unconfigured } = await discover(createStopToken())
  expect(mates.map(m => m.assemblyName)).toEqual(['volvox_ins'])
  // it aligned here, it just cannot be a panel — the dialog says which
  expect(unconfigured).toEqual(['HG002#1'])
})
