import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchemaFactory from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearHicDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearHicDisplay',
      displayName: 'Hi-C contact matrix display',
      configSchema,
      // lazily loaded: fetched when a Hi-C track is shown or a session names
      // this display
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'HicTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazyWithPreload(
        () => import('./components/ReactComponent.tsx'),
      ),
    })
  })
}
