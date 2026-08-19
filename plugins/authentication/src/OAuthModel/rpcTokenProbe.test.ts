import PluginManager from '@jbrowse/core/PluginManager'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

class TestRpcMethod extends RpcMethodType {
  async execute() {}
}

function makeAccount() {
  return stateModelFactory(configSchema).create({
    type: 'OAuthInternetAccount',
    configuration: {
      type: 'OAuthInternetAccount',
      internetAccountId: 'testOAuth',
      name: 'testOAuth',
      clientId: 'testId',
      authEndpoint: 'https://provider.example.com/authorize',
      tokenEndpoint: 'https://provider.example.com/token',
      domains: ['data.example.com'],
    },
  })
}

// A BAM and its index: two UriLocations under one adapter, which is the
// smallest realistic shape and the reason the per-call cost is doubled.
function bamArgs() {
  return {
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        locationType: 'UriLocation',
        uri: 'https://data.example.com/reads.bam',
      },
      index: {
        location: {
          locationType: 'UriLocation',
          uri: 'https://data.example.com/reads.bam.bai',
        },
      },
    },
  }
}

function withAccount(account: ReturnType<typeof makeAccount>) {
  const pluginManager = new PluginManager()
  ;(pluginManager as { rootModel: unknown }).rootModel = {
    internetAccounts: [account],
    findAppropriateInternetAccount: () => account,
  }
  return new TestRpcMethod(pluginManager)
}

function countHeads() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'HEAD')
    .length
}

// A RATCHET ON A KNOWN COST, not a specification: these numbers are what the
// code does today and are meant to come DOWN. `fetchWithToken` carries a
// comment refusing a validateToken pre-flight per request, and this is that
// pre-flight one layer up, where that comment cannot see it. If you are here
// because caching the pre-authorization turned these red, that is the fix
// landing — re-derive both counts from the new behavior rather than widening
// the assertions. Cached, the first is 2 and the second is 0.
// agent-docs/TODO.md, "Stop re-probing the token on every RPC serialization".
test('every RPC serialization re-probes every location it carries', async () => {
  sessionStorage.setItem('testOAuth-token', 'a-good-token')
  fetchMock.mockResolvedValue(new Response('ok'))

  const rpc = withAccount(makeAccount())
  for (let i = 0; i < 10; i++) {
    await rpc.serializeArguments(bamArgs())
  }

  // 2 locations x 10 calls. The guard `serializeNewAuthArguments` checks,
  // `loc.internetAccountPreAuthorization`, is set on args `ownArgs` has just
  // cloned, so it is never set on the next call's input and never suppresses a
  // probe. Nothing between calls caches, so the multiplier is however many RPC
  // calls a session makes — one per region per fetch, not one per block.
  expect(countHeads()).toBe(20)
})

test('the pre-authorization a serialization writes does not survive to the next', async () => {
  sessionStorage.setItem('testOAuth-token', 'a-good-token')
  fetchMock.mockResolvedValue(new Response('ok'))

  const rpc = withAccount(makeAccount())
  const args = bamArgs()
  const first = (await rpc.serializeArguments(args)) as typeof args

  // the returned args carry it, which is what reaches the worker
  expect(first.adapter.bamLocation).toHaveProperty(
    'internetAccountPreAuthorization',
  )
  // and the caller's own object does not, which is what would have stopped the
  // next call from probing
  expect(args.adapter.bamLocation).not.toHaveProperty(
    'internetAccountPreAuthorization',
  )

  const before = countHeads()
  await rpc.serializeArguments(args)
  expect(countHeads() - before).toBe(2)
})
