import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './SpreadsheetViewModel.ts'
import { spreadsheetLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel: stateModelFactory(),
      launchKeys: spreadsheetLaunchKeys,
      ReactComponent: lazy(() => import('./components/SpreadsheetView.tsx')),
    })
  })
}

export type {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetViewModel.ts'
