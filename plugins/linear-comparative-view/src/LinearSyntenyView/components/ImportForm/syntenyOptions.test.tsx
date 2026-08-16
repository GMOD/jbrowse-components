import PluginManager from '@jbrowse/core/PluginManager'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { LinearSyntenyImportFormSyntenyOption } from './ImportSyntenyTrackSelectorArea.tsx'

// The dotplot twin of this file says why either exists: nothing in this repo
// contributes an import-form option, so the shapes the guide teaches could be
// renamed today without anything noticing.
//
// This one carries `selectedRow`, which is the whole reason the point is not
// shared with the dotplot — a synteny form configures one row pair of several,
// and an option that writes into the model has no other way to know which.

function MySyntenyServerComponent() {
  return null
}

// #region register
function addSyntenyOption(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    ({ assembly1, assembly2, selectedRow }) => ({
      value: `my-server-${assembly1}-${assembly2}`,
      label: `Load rows ${selectedRow + 1} and ${selectedRow + 2} from my server`,
      ReactComponent: MySyntenyServerComponent,
    }),
  )
}
// #endregion

test('a contributed option reaches the form, built from the props it is given', () => {
  const pluginManager = new PluginManager([])
  addSyntenyOption(pluginManager)

  const options = pluginManager.evaluateExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    [] as LinearSyntenyImportFormSyntenyOption[],
    {
      model: {} as LinearSyntenyViewModel,
      assembly1: 'volvox',
      assembly2: 'volvox_random',
      selectedRow: 1,
    },
  )

  expect(options).toEqual([
    {
      value: 'my-server-volvox-volvox_random',
      label: 'Load rows 2 and 3 from my server',
      ReactComponent: MySyntenyServerComponent,
    },
  ])
})
