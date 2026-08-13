import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

const roots: Root[] = []

// fetchRemoteConfig() stamps a baseUri beside every uri in the config it
// fetched (addRelativeUris), because a config at data/config.json naming
// "volvox.2bit" means data/volvox.2bit, not /volvox.2bit. Everything
// downstream resolves through it (resolveUriLocation in core/util/io).
const BASE = 'http://localhost/data/config.json'

function makeRoot() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    configPath: 'data/config.json',
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation: {
                uri: 'volvox.2bit',
                baseUri: BASE,
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
    },
  })
  root.setSession({ name: 'testSession' })
  roots.push(root)
  return root
}

function findTwoBit(o: unknown): Record<string, unknown> | undefined {
  if (typeof o === 'object' && o !== null) {
    const rec = o as Record<string, unknown>
    if (typeof rec.uri === 'string' && rec.uri.includes('2bit')) {
      return rec
    }
    for (const v of Object.values(rec)) {
      const hit = findTwoBit(v)
      if (hit) {
        return hit
      }
    }
  }
  return undefined
}

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
  sessionStorage.clear()
  localStorage.clear()
})

// Installing/updating/removing a plugin flips pluginsUpdated, which makes the
// autosave autorun hand a config snapshot to reloadPluginManagerCallback for
// the replacement app to boot from. That snapshot goes through jbrowseModel's
// snapshotProcessor, whose postProcessor runs stripBaseUris — written for the
// admin "Save config" flow (JBrowse.tsx POSTs onSnapshot(jbrowse) straight to
// /updateConfig, so it must not carry synthetic keys). The reload gets caught
// by it too, and the replacement boots on a config whose relative uris now
// resolve against the page instead of the config's directory: every such track
// 404s after any plugin install.
test('the plugin reload hands over a config whose relative uris still resolve', async () => {
  const root = makeRoot()
  const configs: Record<string, unknown>[] = []
  root.setReloadPluginManagerCallback(config => {
    configs.push(config)
  })

  root.setPluginsUpdated()
  // the autosave autorun is debounced 400ms
  await new Promise(r => setTimeout(r, 800))

  expect(configs).toHaveLength(1)
  expect(findTwoBit(configs[0])).toEqual(
    expect.objectContaining({ uri: 'volvox.2bit', baseUri: BASE }),
  )
})
