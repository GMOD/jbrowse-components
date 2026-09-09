import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchemaFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ManhattanReactComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent.tsx'),
)

export default function LinearManhattanDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearManhattanDisplay',
      configSchema,
      // lazily loaded: the model composes the wiggle score mixins, and is
      // fetched when a GWAS track is shown or a session names this display
      stateModel: () =>
        import('./stateModelFactory.ts').then(f =>
          f.stateModelFactory(pluginManager, configSchema),
        ),
      // A FeatureTrack too: the plot reads `score` (or the `scoreField` slot)
      // off whatever feature adapter the track carries, so any BED-like file
      // with a numeric column is a Manhattan plot waiting for the display
      trackType: ['GWASTrack', 'FeatureTrack'],
      viewType: 'LinearGenomeView',
      ReactComponent: ManhattanReactComponent,
    })
  })
}
