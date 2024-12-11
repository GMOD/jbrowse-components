import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './SpreadsheetViewModel'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel: stateModelFactory(),
      ReactComponent: lazy(() => import('./components/SpreadsheetView')),
    })
  })
}

export type {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetViewModel'
