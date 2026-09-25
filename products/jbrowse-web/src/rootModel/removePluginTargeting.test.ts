import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

jest.mock('../makeWorkerInstance', () => () => {})

type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

const roots: Root[] = []

function makeRoot(plugins: PluginDefinition[]) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      plugins,
    },
  })
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
})

const v1: PluginDefinition = {
  name: 'GWAS',
  umdUrl: 'https://jbrowse.org/plugins/jbrowse-plugin-gwas/1.0.0/g.umd.js',
}
const v2: PluginDefinition = {
  name: 'GWAS',
  umdUrl: 'https://jbrowse.org/plugins/jbrowse-plugin-gwas/2.0.0/g.umd.js',
}

// The update flow is removePlugin(current) then addPlugin(next), and both
// definitions carry the same UMD name — so removal has to be keyed on the url,
// or updating removes the version it just installed.
test('removes the entry loading from that url, not every entry sharing a name', () => {
  const root = makeRoot([v1, v2])
  root.jbrowse.removePlugin(v1)
  expect(root.jbrowse.plugins).toEqual([v2])
})

// Keyed on pluginUrl, whose miss value is the display string 'unknown url', two
// definitions naming no loader compared equal — so removing one filtered out
// every other one. Nothing in the UI can reach this (an entry that never loads
// is never in runtimePluginDefinitions, so it gets no InstalledPlugin row), but
// the filter it feeds also walks the entries a hand-written config carries.
test('a definition that names no loader removes no other such entry', () => {
  const broken = {} as PluginDefinition
  const alsoBroken = { name: 'Handwritten' } as PluginDefinition
  const root = makeRoot([broken, alsoBroken, v1])
  root.jbrowse.removePlugin(broken)
  expect(root.jbrowse.plugins).toEqual([broken, alsoBroken, v1])
})

test('removing a real entry leaves the unloadable ones beside it alone', () => {
  const broken = {} as PluginDefinition
  const root = makeRoot([broken, v1])
  root.jbrowse.removePlugin(v1)
  expect(root.jbrowse.plugins).toEqual([broken])
})

// A config that names a plugin by store entry carries no url at all, and the
// loaded copy's url is one the entry never held — so a remove keyed on that url
// filtered nothing while still asking for the whole-app reload an uninstall
// triggers. The admin clicked uninstall, the app rebuilt, the plugin came back.
const ref: PluginDefinition = { storePlugin: 'GWAS' }
const resolvedRef: PluginDefinition = {
  name: 'GWAS',
  umdUrl: 'https://jbrowse.org/plugins/jbrowse-plugin-gwas/2.0.0/g.umd.js',
  storePlugin: 'GWAS',
}

test('removes a bare store ref when handed the definition it resolved to', () => {
  const root = makeRoot([ref])
  root.jbrowse.removePlugin(resolvedRef)
  expect(root.jbrowse.plugins).toEqual([])
})

test('a store ref removes no entry for another plugin', () => {
  const root = makeRoot([{ storePlugin: 'MsaView' }, ref])
  root.jbrowse.removePlugin(resolvedRef)
  expect(root.jbrowse.plugins).toEqual([{ storePlugin: 'MsaView' }])
})

// the version swap the url match exists for, with both entries carrying the ref
// the store minted them under: matching the ref alone would take both
test('a ref-carrying update still swaps one version for the other', () => {
  const v1Ref = { ...v1, storePlugin: 'GWAS' }
  const v2Ref = { ...v2, storePlugin: 'GWAS' }
  const root = makeRoot([v1Ref, v2Ref])
  root.jbrowse.removePlugin(v1Ref)
  expect(root.jbrowse.plugins).toEqual([v2Ref])
})
