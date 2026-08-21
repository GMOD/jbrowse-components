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

// `volvox` also answers to `vvx`, the shape an `aliases` entry gives a session.
function setup({
  assemblyNames = ['volvox', 'volvox_ins'],
  anchorRegion = region,
}: { assemblyNames?: string[]; anchorRegion?: Region } = {}) {
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
    assemblyManager: {
      getCanonicalAssemblyName: (name: string) =>
        ({ vvx: 'volvox', volvox: 'volvox' })[name],
    },
  } as unknown as AbstractSessionModel
  const track = schema.create({
    trackId: 't1',
    assemblyNames,
    adapter: { type: 'PAFAdapter', uri: 'x.paf' },
  })
  return {
    discover: makeMateDiscovery({ session, track, region: anchorRegion }),
    calls,
  }
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

// The worker has no assembly manager, and the two comparisons it runs — "is
// this mate the anchor's own lane" and "is every declared name the anchor, i.e.
// a self-alignment" — are plain string equality against `trackAssemblyNames`.
// So the anchor has to arrive spelled the way the TRACK spells it, not the way
// the view happens to be open.
//
// A view reaches here on an alias routinely: `getSyntenyTracks` resolves
// aliases to decide the track is launchable at all, so the launch is offered
// for a track whose declared name the region does not share.
test("the anchor crosses to the worker in the track's spelling", async () => {
  const { discover, calls } = setup({
    anchorRegion: { ...region, assemblyName: 'vvx' },
  })
  await discover(createStopToken(), jest.fn())
  expect(calls[0]!.args.anchorAssembly).toBe('volvox')
})

// A self-alignment track — every declared name the anchor's, a genome against
// its own paralogy. Left as `vvx` this reported no self-alignment, which drops
// the one lane that IS the comparison and leaves the dialog saying nothing
// aligned.
test('a self-alignment track resolves the anchor to its declared name', async () => {
  const { discover, calls } = setup({
    assemblyNames: ['volvox', 'volvox'],
    anchorRegion: { ...region, assemblyName: 'vvx' },
  })
  await discover(createStopToken(), jest.fn())
  expect(calls[0]!.args.anchorAssembly).toBe('volvox')
})

// A track declaring nothing the region resolves to keeps the region's own name,
// which is the only answer available and what the comparisons degraded to
// before. An all-vs-all file's undeclared PanSN samples land here.
test('an anchor no declared name matches stays as the region spells it', async () => {
  const { discover, calls } = setup({
    assemblyNames: ['grape', 'peach'],
    anchorRegion: { ...region, assemblyName: 'vvx' },
  })
  await discover(createStopToken(), jest.fn())
  expect(calls[0]!.args.anchorAssembly).toBe('vvx')
})
