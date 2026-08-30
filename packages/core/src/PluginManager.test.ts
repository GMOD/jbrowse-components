import { types } from '@jbrowse/mobx-state-tree'

import Plugin from './Plugin.ts'
import PluginManager from './PluginManager.ts'
import ViewType from './pluggableElementTypes/ViewType.ts'

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
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
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
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('already installed'),
  )
  warn.mockRestore()
})

test('a skipped duplicate is not reported as an installed runtime plugin', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const { bundled, downloaded } = pluginPair()
  const pluginManager = new PluginManager([bundled])
  pluginManager.addPlugin({
    plugin: downloaded,
    definition: { name: 'Duplicate', url: 'https://example.com/dup.js' },
    metadata: { url: 'https://example.com/dup.js' },
  })

  expect(pluginManager.runtimePluginDefinitions).toEqual([])
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('already installed'),
  )
  warn.mockRestore()
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

// A build with a different plugin set — every embedded product lets a consumer
// supply their own array — fails at a registration-time cross-plugin lookup
// (`pm.getDisplayType('LinearAlignmentsDisplay')` from a track's install), and
// that throw is the entire message the user gets: jbrowse-web parks it in
// `pluginManagerError` and renders nothing else.
describe('a missing pluggable type says what is missing', () => {
  function managerWithViews(names: string[]) {
    class ViewsPlugin extends Plugin {
      name = 'ViewsPlugin'
      install(pluginManager: PluginManager) {
        for (const name of names) {
          pluginManager.addViewType(
            () =>
              new ViewType({
                name,
                stateModel: types.model(name, {
                  id: types.optional(types.identifier, name),
                  type: types.literal(name),
                }),
                ReactComponent: () => null,
              }),
          )
        }
      }
    }
    return new PluginManager([new ViewsPlugin()])
      .createPluggableElements()
      .configure()
  }

  it('names the type, its group, and what is registered', () => {
    const pm = managerWithViews(['LinearGenomeView', 'DotplotView'])

    expect(() => pm.getViewType('SpreadsheetView')).toThrow(
      /ViewType 'SpreadsheetView' is not registered/,
    )
    // the half that answers "which plugin": a build short one plugin is short
    // that plugin's group of names
    expect(() => pm.getViewType('SpreadsheetView')).toThrow(
      /Registered ViewTypes: DotplotView, LinearGenomeView/,
    )
  })

  // The other way to reach an empty record, and a different bug from a missing
  // plugin: nothing is registered until createPluggableElements() runs
  it('distinguishes a lookup made before createPluggableElements', () => {
    expect(() => new PluginManager([]).getViewType('LinearGenomeView')).toThrow(
      /before createPluggableElements/,
    )
  })
})
