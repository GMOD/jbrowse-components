import PluginManager from '@jbrowse/core/PluginManager'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchema from './configSchema.ts'

// The crossing test for the reason htsgetBase is a location at all. A worker has
// no root model and so no internet accounts; the only way a credential reaches
// one is `serializeArguments` walking the args for locations and stamping
// `internetAccountPreAuthorization` on each. The walk finds a location by its
// `uri` key, so while htsgetBase was a plain string it was invisible — and every
// worker-driver product, which is jbrowse-web's default, read the endpoint
// unauthenticated no matter what the config said.
const pluginManager = new PluginManager()

class MockRpcMethodType extends RpcMethodType {
  async execute() {}
}

function withAccounts() {
  const original = pluginManager.rootModel
  ;(pluginManager as { rootModel: unknown }).rootModel = {
    findAppropriateInternetAccount: () => undefined,
    internetAccounts: [{ internetAccountId: 'mock' }],
  }
  return () => {
    ;(pluginManager as { rootModel: unknown }).rootModel = original
  }
}

test('the pre-auth walk reaches htsgetBase', async () => {
  const restore = withAccounts()
  try {
    const rpc = new MockRpcMethodType(pluginManager)
    const asked: string[] = []
    rpc.serializeNewAuthArguments = jest.fn(async loc => {
      asked.push(loc.uri)
      return loc
    })

    await rpc.serializeArguments({
      adapterConfig: getSnapshot(
        configSchema.create({
          type: 'HtsgetBamAdapter',
          htsgetBase: 'https://htsget.example.com/reads',
          htsgetTrackId: 'NA12878',
        }),
      ),
    })

    expect(asked).toEqual(['https://htsget.example.com/reads'])
  } finally {
    restore()
  }
})
