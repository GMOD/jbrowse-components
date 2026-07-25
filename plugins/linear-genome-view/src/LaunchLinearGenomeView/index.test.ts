import PluginManager from '@jbrowse/core/PluginManager'

import LaunchLinearGenomeViewF from './index.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// the real extension point on a real plugin manager, against a session stubbed
// down to the one action a launch calls
function setup() {
  const pluginManager = new PluginManager()
  LaunchLinearGenomeViewF(pluginManager)
  const addView = jest.fn()
  return {
    pluginManager,
    addView,
    session: { addView } as unknown as AbstractSessionModel,
  }
}

test('resolution keys go to init, plain props to the snapshot, id stays pinned', async () => {
  const { pluginManager, session, addView } = setup()

  await pluginManager.evaluateAsyncExtensionPointStrict(
    'LaunchView-LinearGenomeView',
    {
      session,
      id: 'pinned-view',
      assembly: 'volvox',
      loc: 'ctgA:1-100',
      tracks: ['gff3tabix_genes'],
      colorByCDS: true,
    },
  )

  expect(addView).toHaveBeenCalledWith('LinearGenomeView', {
    id: 'pinned-view',
    colorByCDS: true,
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1-100',
      tracks: ['gff3tabix_genes'],
    },
  })
})

test('a spec with no assembly throws instead of opening an empty view', async () => {
  const { pluginManager, session, addView } = setup()

  await expect(
    pluginManager.evaluateAsyncExtensionPointStrict(
      'LaunchView-LinearGenomeView',
      { session, loc: 'ctgA:1-100' },
    ),
  ).rejects.toThrow('No assembly provided')
  expect(addView).not.toHaveBeenCalled()
})

test('a typo warns rather than vanishing into a dropped snapshot key', async () => {
  const { pluginManager, session, addView } = setup()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  await pluginManager.evaluateAsyncExtensionPointStrict(
    'LaunchView-LinearGenomeView',
    { session, assembly: 'volvox', tracksList: true },
  )

  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('ignored unknown key(s): tracksList'),
  )
  // the rest of the spec still launches
  expect(addView).toHaveBeenCalledWith('LinearGenomeView', {
    id: undefined,
    init: { assembly: 'volvox' },
  })
  warn.mockRestore()
})
