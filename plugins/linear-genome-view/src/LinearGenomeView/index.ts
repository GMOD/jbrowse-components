import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { stateModelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearGenomeView',
      displayName: 'Linear genome view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearGenomeView.tsx')),
    })
  })
}

export * from './model.ts'
export * from './types.ts'
export {
  type SyncableViewAction,
  installLinkedViewSync,
} from './linkedViewSync.ts'
export { default as LinearGenomeView } from './components/LinearGenomeView.tsx'
export { default as SearchBox } from './components/SearchBox.tsx'
export { default as HighlightBand } from './components/HighlightBand.tsx'
export { default as HighlightChip } from './components/HighlightChip.tsx'
export { default as OverviewHighlightBand } from './components/OverviewHighlightBand.tsx'
