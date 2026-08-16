import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createStopToken } from '@jbrowse/core/util/stopToken'

import { makeMateDiscovery } from './discoverMates.ts'

import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

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

function setup() {
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
        return Promise.resolve({ mates: [], unconfigured: [] })
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

// The wiring the dialog's cancel and its progress label depend on: the handles
// it creates are worthless unless they ride along to the worker, where the
// download+parse checks the one and reports through the other.
// `regions` is plural for refName renaming, which applies to that key alone.
test('everything the worker-side reduction needs reaches the RPC', async () => {
  const { discover, calls } = setup()
  const stopToken = createStopToken()
  const statusCallback = jest.fn()
  await discover(stopToken, statusCallback)

  expect(calls.length).toBe(1)
  const { sessionId, method, args } = calls[0]!
  expect(sessionId).toBe('t1')
  expect(method).toBe('SyntenyDiscoverMates')
  expect(args.stopToken).toBe(stopToken)
  expect(args.statusCallback).toBe(statusCallback)
  expect(args.regions).toEqual([region])
  expect(args.adapterConfig).toEqual({ type: 'PAFAdapter', uri: 'x.paf' })
  // which mates can become a panel is decided against these, and the config
  // they are read from lives on this side of the boundary
  expect(args.trackAssemblyNames).toEqual(['volvox', 'volvox_ins'])
  expect(args.anchorAssembly).toBe('volvox')
})
