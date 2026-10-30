import {
  UntrustedPluginsError,
  assertPluginsTrusted,
} from './assertPluginsTrusted.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

const untrusted: PluginDefinition[] = [
  { name: 'Evil', umdUrl: 'https://evil.example/p.js' },
]

function deps(checked: boolean, accepted = false) {
  return {
    checkPlugins: jest.fn().mockResolvedValue(checked),
    confirm: jest.fn().mockResolvedValue(accepted),
  }
}

test('no plugins needs no check or prompt', async () => {
  const d = deps(true)
  await assertPluginsTrusted([], d)
  await assertPluginsTrusted(undefined, d)
  expect(d.checkPlugins).not.toHaveBeenCalled()
  expect(d.confirm).not.toHaveBeenCalled()
})

test('store-known plugins load without prompting', async () => {
  const d = deps(true)
  await assertPluginsTrusted(untrusted, d)
  expect(d.confirm).not.toHaveBeenCalled()
})

test('unknown plugins the user accepts are allowed through', async () => {
  const d = deps(false, true)
  await assertPluginsTrusted(untrusted, d)
  expect(d.confirm).toHaveBeenCalledWith([
    { description: 'UMD plugin Evil', url: 'https://evil.example/p.js' },
  ])
})

test('unknown plugins the user declines abort the load', async () => {
  const d = deps(false, false)
  await expect(assertPluginsTrusted(untrusted, d)).rejects.toThrow(
    UntrustedPluginsError,
  )
})

// MafViewer and friends are stripped before PluginLoader runs, so a config
// listing only vendored plugins must not prompt — jbrowse.org demos do this
test('vendored plugins are dropped rather than prompted for', async () => {
  const d = deps(false, false)
  await assertPluginsTrusted(
    [{ name: 'MafViewer', umdUrl: 'https://jbrowse.org/x.js' }],
    d,
  )
  expect(d.checkPlugins).not.toHaveBeenCalled()
  expect(d.confirm).not.toHaveBeenCalled()
})

// a packaged Desktop loads a umdLoc/esmLoc that resolves to a local file, which
// is for a config the user opened from disk, not one a link handed over
test('a config from outside cannot name a plugin on this computer', async () => {
  for (const plugin of [
    { name: 'A', esmLoc: { uri: 'file:///home/u/Downloads/x.js' } },
    {
      name: 'B',
      umdLoc: { uri: 'x.js', baseUri: 'file:///home/u/Downloads/' },
    },
  ]) {
    const d = deps(false, true)
    await expect(assertPluginsTrusted([plugin], d)).rejects.toThrow(
      'file:///home/u/Downloads/x.js',
    )
    expect(d.confirm).not.toHaveBeenCalled()
  }
})

// the prompt names where the plugin loads from, which a baseUri decides
test('the prompt shows the url a umdLoc resolves to', async () => {
  const d = deps(false, true)
  await assertPluginsTrusted(
    [{ name: 'Hub', umdLoc: { uri: 'p.js', baseUri: 'https://hub.org/c/' } }],
    d,
  )
  expect(d.confirm).toHaveBeenCalledWith([
    { description: 'UMD plugin Hub', url: 'https://hub.org/c/p.js' },
  ])
})
