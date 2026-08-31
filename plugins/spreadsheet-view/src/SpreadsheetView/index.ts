import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './SpreadsheetViewModel.ts'
import { spreadsheetLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    // annotated against the registry rather than inferred, which is what
    // makes a hand-written augmentation earn what `getViewType` promises
    // its callers — see `ViewTypeRegistry`
    const stateModel: ViewTypeRegistry['SpreadsheetView'] = stateModelFactory()
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel,
      launchKeys: spreadsheetLaunchKeys,
      ReactComponent: lazy(() => import('./components/SpreadsheetView.tsx')),
    })
  })
}

export type {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetViewModel.ts'
