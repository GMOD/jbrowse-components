import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { spreadsheetLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    // annotated against the registry rather than inferred, which is what
    // makes a hand-written augmentation earn what `getViewType` promises
    // its callers — see `ViewTypeRegistry`
    const stateModel = (): Promise<ViewTypeRegistry['SpreadsheetView']> =>
      import('./SpreadsheetViewModel.ts').then(f => f.default(pluginManager))
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel,
      launchKeys: spreadsheetLaunchKeys,
      ReactComponent: lazyWithPreload(
        () => import('./components/SpreadsheetView.tsx'),
      ),
    })
  })
}

export type {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetViewModel.ts'
