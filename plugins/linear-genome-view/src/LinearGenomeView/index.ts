import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { lgvLaunchKeys } from './launchKeys.ts'
import { stateModelFactory } from './model.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

declare module '@jbrowse/core/PluginManager' {
  // The two container points render through PluggableElements' `name` prop, so
  // there is no string-literal fire site for their docs tags to sit at; they
  // live here at the contract, the same way Core-replaceWidget's does.
  interface ExtensionPointRegistry {
    // #region tracksContainer
    /** #extensionPoint LinearGenomeView-TracksContainerComponent | sync | Add a component into the LGV tracks container */
    'LinearGenomeView-TracksContainerComponent': ElementList<{
      model: LinearGenomeViewModel
    }>
    // #endregion
    /** #extensionPoint LinearGenomeView-ScalebarHighlightComponent | sync | Add a highlight component to the scalebar */
    'LinearGenomeView-ScalebarHighlightComponent': ElementList<{
      model: LinearGenomeViewModel
    }>
    /** #extensionPoint LinearGenomeView-HighlightSVGComponent | sync | Add an SVG highlight overlay in the LGV SVG export */
    'LinearGenomeView-HighlightSVGComponent': ElementList<{
      model: LinearGenomeViewModel
      height: number
    }>
    // #region overviewScalebar
    /** #extensionPoint LinearGenomeView-OverviewScalebarComponent | sync | Add a component to the overview scalebar */
    'LinearGenomeView-OverviewScalebarComponent': ElementList<{
      model: LinearGenomeViewModel
      overview: ViewLayout
    }>
    // #endregion
  }
}

export default function LinearGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    // annotated against the registry rather than inferred, which is what
    // makes a hand-written augmentation earn what `getViewType` promises
    // its callers — see `ViewTypeRegistry`
    const stateModel: ViewTypeRegistry['LinearGenomeView'] =
      stateModelFactory(pluginManager)
    return new ViewType({
      name: 'LinearGenomeView',
      displayName: 'Linear genome view',
      stateModel,
      launchKeys: lgvLaunchKeys,
      ReactComponent: lazy(() => import('./components/LinearGenomeView.tsx')),
    })
  })
}

export { stateModelFactory } from './model.ts'
export { lgvLaunchKeys } from './launchKeys.ts'
export type {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from './model.ts'
export type {
  BpOffset,
  ExportSvgOptions,
  HighlightType,
  InitState,
  LinearGenomeViewLaunchProps,
  NavLocation,
  TrackLabelMode,
  VolatileGuide,
} from './types.ts'
export {
  type SyncableViewAction,
  installLinkedViewSync,
} from './linkedViewSync.ts'
export { default as HighlightBand } from './components/HighlightBand.tsx'
export { default as HighlightChip } from './components/HighlightChip.tsx'
export { default as OverviewHighlightBand } from './components/OverviewHighlightBand.tsx'
export { default as SVGHighlightBand } from './components/SVGHighlightBand.tsx'
