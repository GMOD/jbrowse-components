import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { linearSyntenyViewHelperModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// LinearSyntenyViewHelper is hidden from the GUI; the helper has no UI of its
// own — the LinearComparativeView renders LevelSyntenyCanvas for each level.
const HelperPlaceholder = () => null

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyViewHelper',
      displayName: 'Linear synteny view (helper)',
      viewMetadata: {
        hiddenFromGUI: true,
      },
      stateModel: linearSyntenyViewHelperModelFactory(pluginManager),
      ReactComponent: HelperPlaceholder,
    })
  })
}
