import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchemaF from './models/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ChordVariantDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'ChordVariantDisplay',
      displayName: 'Chord variant display',
      configSchema,
      // lazily loaded: fetched when a variant track is shown in a circular
      // view or a session names this display
      stateModel: () =>
        import('./models/stateModelFactory.ts').then(f =>
          f.default(configSchema),
        ),
      trackType: 'VariantTrack',
      viewType: 'CircularView',
      ReactComponent: lazyWithPreload(
        () => import('./components/ChordVariantDisplay.tsx'),
      ),
    })
  })
}
