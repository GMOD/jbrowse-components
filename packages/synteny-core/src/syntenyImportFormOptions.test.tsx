import PluginManager from '@jbrowse/core/PluginManager'

import type { SyntenyImportFormOptionProps } from './SelectorTypes.ts'

// Nothing in this repo contributes an import-form option, so these pin the two
// shapes the guide example teaches: the option's fields and the props a
// contributor is handed.

function MySyntenyServerComponent() {
  return null
}

// #region register
function addSyntenyOption(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'SyntenyImportForm-Options',
    ({ model, assembly1, assembly2, rowIndex }) => ({
      value: `my-server-${assembly1}-${assembly2}`,
      label:
        model.type === 'LinearSyntenyView'
          ? `Load rows ${rowIndex + 1} and ${rowIndex + 2} from my server`
          : 'Load from my server',
      ReactComponent: MySyntenyServerComponent,
    }),
  )
}
// #endregion

test('a contributed option reaches the form, built from the props it is given', () => {
  const pluginManager = new PluginManager([])
  addSyntenyOption(pluginManager)

  const options = pluginManager.evaluateExtensionPoint(
    'SyntenyImportForm-Options',
    [],
    {
      model: { type: 'LinearSyntenyView' },
      assembly1: 'volvox',
      assembly2: 'volvox_random',
      rowIndex: 1,
    } as SyntenyImportFormOptionProps,
  )

  expect(options).toEqual([
    {
      value: 'my-server-volvox-volvox_random',
      label: 'Load rows 2 and 3 from my server',
      ReactComponent: MySyntenyServerComponent,
    },
  ])
})
