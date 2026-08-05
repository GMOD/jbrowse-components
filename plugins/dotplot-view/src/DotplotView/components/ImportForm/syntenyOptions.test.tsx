import PluginManager from '@jbrowse/core/PluginManager'

import type { DotplotViewModel } from '../../model.ts'
import type { DotplotImportFormSyntenyOption } from './TrackSelector.tsx'

// Nothing in this repo contributes an import-form option: the built-in ways in
// are the file-format list, not this point, so it exists for plugins outside the
// repo. These pin the two shapes its guide example teaches — the option's fields
// and the props a contributor is handed — either of which could be renamed today
// without anything noticing.

function MySyntenyServerComponent() {
  return null
}

// #region register
function addSyntenyOption(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'DotplotView-ImportFormSyntenyOptions',
    ({ assembly1, assembly2 }) => ({
      value: `my-server-${assembly1}-${assembly2}`,
      label: 'Load from my server',
      ReactComponent: MySyntenyServerComponent,
    }),
  )
}
// #endregion

test('a contributed option reaches the form, built from the props it is given', () => {
  const pluginManager = new PluginManager([])
  addSyntenyOption(pluginManager)

  const options = pluginManager.evaluateExtensionPoint(
    'DotplotView-ImportFormSyntenyOptions',
    [] as DotplotImportFormSyntenyOption[],
    {
      model: {} as DotplotViewModel,
      assembly1: 'volvox',
      assembly2: 'volvox_random',
    },
  )

  expect(options).toEqual([
    {
      value: 'my-server-volvox-volvox_random',
      label: 'Load from my server',
      ReactComponent: MySyntenyServerComponent,
    },
  ])
})
