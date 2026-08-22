import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel: () =>
        import('./SpreadsheetViewModel.ts').then(f => f.default()),
      ReactComponent: lazy(() => import('./components/SpreadsheetView.tsx')),
    })
  })
}

export type {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetViewModel.ts'
