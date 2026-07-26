import Plugin from './Plugin.ts'
import PluginManager from './PluginManager.ts'

// Two separately-built copies of one plugin: what a product that bundles a
// plugin gets when a config also names its hosted url. They are different
// classes from different bundles, which is why identity cannot tell them apart
// and the name has to.
function pluginPair() {
  const installed: string[] = []
  class Bundled extends Plugin {
    name = 'DuplicatePlugin'
    install() {
      installed.push('bundled')
    }
  }
  class Downloaded extends Plugin {
    name = 'DuplicatePlugin'
    install() {
      installed.push('downloaded')
    }
  }
  return { installed, bundled: new Bundled(), downloaded: new Downloaded() }
}

test('installs a plugin once, whichever copy arrives first', () => {
  const { installed, bundled, downloaded } = pluginPair()
  const pluginManager = new PluginManager([bundled])
  pluginManager.addPlugin(downloaded)

  // the core copy is added first and is the one that stays; install() running
  // twice is what doubles a plugin's menu items, since appendToMenu has no
  // dedup of its own
  expect(installed).toEqual(['bundled'])
  expect(
    pluginManager.plugins.filter(p => p.name === 'DuplicatePlugin'),
  ).toEqual([bundled])
  expect(pluginManager.getPlugin('DuplicatePlugin')).toBe(bundled)
})

test('a skipped duplicate is not reported as an installed runtime plugin', () => {
  const { bundled, downloaded } = pluginPair()
  const pluginManager = new PluginManager([bundled])
  pluginManager.addPlugin({
    plugin: downloaded,
    definition: { name: 'Duplicate', url: 'https://example.com/dup.js' },
    metadata: { url: 'https://example.com/dup.js' },
  })

  expect(pluginManager.runtimePluginDefinitions).toEqual([])
})

test('still installs plugins that differ by name', () => {
  const { installed, bundled } = pluginPair()
  class Other extends Plugin {
    name = 'OtherPlugin'
    install() {
      installed.push('other')
    }
  }
  const pluginManager = new PluginManager([bundled])
  pluginManager.addPlugin(new Other())

  expect(installed).toEqual(['bundled', 'other'])
})
