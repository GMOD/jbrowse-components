import PluginManager from '@jbrowse/core/PluginManager'

import type { StartScreenMenuItemsProps } from './startScreenExtensionPoints.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Nothing in this repo contributes to the start screen points — they exist for
// the user's global plugins, which by definition live outside it. The guide
// generates its example from the registration below, and these assert the two
// things that section promises.

const CONFIG_PATH = '/tmp/my.jbrowse.json'

// #region register
function addStartScreenMenuItem(
  pluginManager: PluginManager,
  configPath: string,
) {
  pluginManager.contributeToExtensionPoint(
    'Desktop-StartScreenMenuItems',
    ({ setPluginManager, loadPluginManager }) => ({
      label: 'Open my thing...',
      onClick: () => {
        loadPluginManager(configPath)
          .then(setPluginManager)
          .catch(console.error)
      },
    }),
  )
}
// #endregion

function fire(pluginManager: PluginManager) {
  const loadPluginManager = jest.fn().mockResolvedValue(pluginManager)
  const props = {
    pluginManager,
    setPluginManager: jest.fn(),
    loadPluginManager,
  } as unknown as StartScreenMenuItemsProps
  const items = pluginManager.evaluateExtensionPoint(
    'Desktop-StartScreenMenuItems',
    [] as MenuItem[],
    props,
  )
  return { items, loadPluginManager, props }
}

test('a contributed item can open a session with the props it is handed', () => {
  const pluginManager = new PluginManager([])
  addStartScreenMenuItem(pluginManager, CONFIG_PATH)

  const { items, loadPluginManager } = fire(pluginManager)
  expect(items).toHaveLength(1)
  const item = items[0] as { label: string; onClick: () => void }
  expect(item.label).toBe('Open my thing...')

  item.onClick()
  expect(loadPluginManager).toHaveBeenCalledWith(CONFIG_PATH)
})

test('a plugin whose callback throws costs only its own items', () => {
  const pluginManager = new PluginManager([])
  pluginManager.contributeToExtensionPoint(
    'Desktop-StartScreenMenuItems',
    () => {
      throw new Error('a misbehaving global plugin')
    },
  )
  addStartScreenMenuItem(pluginManager, CONFIG_PATH)

  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  // the start screen still gets the other plugin's item, which is what keeps
  // the dialog that can uninstall the bad plugin reachable
  expect(fire(pluginManager).items).toHaveLength(1)
  expect(error).toHaveBeenCalled()
  error.mockRestore()
})
