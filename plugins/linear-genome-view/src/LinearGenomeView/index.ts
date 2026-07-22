import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { stateModelFactory } from './model.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { ReactNode } from 'react'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LinearGenomeView-TracksContainerComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel }
    }
    'LinearGenomeView-ScalebarHighlightComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel }
    }
    'LinearGenomeView-HighlightSVGComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel; height: number }
    }
    'LinearGenomeView-OverviewScalebarComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel; overview: ViewLayout }
    }
  }
}

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
export type * from './types.ts'
export {
  type SyncableViewAction,
  installLinkedViewSync,
} from './linkedViewSync.ts'
export { default as LinearGenomeView } from './components/LinearGenomeView.tsx'
export { default as SearchBox } from './components/SearchBox.tsx'
export { default as HighlightBand } from './components/HighlightBand.tsx'
export { default as HighlightChip } from './components/HighlightChip.tsx'
export { default as OverviewHighlightBand } from './components/OverviewHighlightBand.tsx'
export { default as SVGHighlightBand } from './components/SVGHighlightBand.tsx'
