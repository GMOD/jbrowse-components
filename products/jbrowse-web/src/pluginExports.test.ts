import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import baseline from './pluginExportsBaseline.json'

// A plugin's `exports` object is the second runtime ABI, beside the
// `@jbrowse/core/*` modules `abi.test.ts` pins: a prebuilt plugin bundle reaches
// it as `pluginManager.getPlugin('LinearGenomeViewPlugin').exports.X`, so a name
// that leaves one of these objects becomes `undefined` inside a UMD nobody is
// going to rebuild. Bundles read it while their `install` runs, so composing a
// missing factory throws there, the plugin's track type never registers, and a
// saved session opens with the track simply absent.
//
// It has happened: `LinearGenomeViewPlugin.exports` lost `BaseLinearDisplay` and
// `BaseLinearDisplayComponent` with the server-side render path, and nothing in
// the tree said so -- `check-published-plugins.ts` filters its findings on
// `@jbrowse/core/`, which no plugin export matches.
//
// Same doctrine as abiBaseline.json, and deliberately not a `pnpm autogen`
// generator: removals fail here, additions don't, and a generator would rewrite
// the file with the removal in it. To drop a name, delete it from
// pluginExportsBaseline.json in the same commit and say in the message which
// published plugins were checked.
//
// What this cannot catch is a signature. `getReferring` still resolves and takes
// a `trackId` string where a v4 caller passes the config object, so every
// comparison inside misses and the answer is `[]` with nothing thrown -- a name
// snapshot has nothing to say about that class, and only
// `pluginFacingSessionApi.test.ts`'s shape, performing the call the way a
// published bundle spells it, does. A name whose value is a namespace object
// (`WigglePlugin.exports.utils`) is pinned as one name for the same reason: what
// is inside it is not checked here.
describe('plugin exports ABI', () => {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  const exportsOf = (name: string) =>
    (
      pluginManager.getPlugin(name) as
        | { exports?: Record<string, unknown> }
        | undefined
    )?.exports

  it.each(Object.entries(baseline as Record<string, string[]>))(
    '%s keeps every export plugins may have linked',
    (name, names) => {
      const mod = exportsOf(name)
      expect(mod).toBeDefined()
      // The value, not the key. What a consumer meets is `undefined` either
      // way — the upgrade guide defines the failure that way — and the keys
      // here are shorthand over imported bindings, three of them `lazy()` in
      // `lazyPluginExports.tsx`. So a broken import path or a renamed default
      // leaves the key standing over nothing, and a key-presence check passes
      // while composing the name throws inside the bundle's `install`.
      const missing = names.filter(n => mod![n] === undefined)
      expect(missing).toEqual([])
    },
  )

  it('pins every plugin that publishes an exports object', () => {
    const unpinned = pluginManager.plugins
      .filter(p => Object.keys(exportsOf(p.name) ?? {}).length > 0)
      .map(p => p.name)
      .filter(name => !(name in baseline))
    expect(unpinned).toEqual([])
  })
})
