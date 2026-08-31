import PluginManager from '@jbrowse/core/PluginManager'

import LinearGenomeViewPlugin from '../index.ts'
import LaunchLinearGenomeViewF from './index.ts'

import type { LaunchLinearGenomeViewArgs } from './index.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The real extension point on a real plugin manager, against a session stubbed
// down to the one action a launch calls.
function setup() {
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  LaunchLinearGenomeViewF(pluginManager)
  const addView = jest.fn()
  return {
    pluginManager,
    addView,
    session: { addView } as unknown as AbstractSessionModel,
  }
}

// The launcher sorts nothing: the view's own preProcessSnapshot partitions the
// snapshot, which is what makes a spec, a defaultSession view and an addView
// literal one shape. A launcher that partitioned here would decide it twice.
test('the spec reaches addView flat, id and all', async () => {
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
    assembly: 'volvox',
    loc: 'ctgA:1-100',
    tracks: ['gff3tabix_genes'],
    colorByCDS: true,
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

// A typo is the view's to report, once, when it attaches — the launcher forwards
// it rather than warning here, which would say the same thing a second time.
test('a typo is forwarded rather than dropped or reported twice', async () => {
  const { pluginManager, session, addView } = setup()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  await pluginManager.evaluateAsyncExtensionPointStrict(
    'LaunchView-LinearGenomeView',
    // the args reaching this point come from a session spec URL, which can
    // carry any key, so the typo under test is one TypeScript would reject at
    // a typed call site and only the runtime guard can catch
    {
      session,
      assembly: 'volvox',
      tracksList: true,
    } as LaunchLinearGenomeViewArgs,
  )

  expect(addView).toHaveBeenCalledWith('LinearGenomeView', {
    assembly: 'volvox',
    tracksList: true,
  })
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})
