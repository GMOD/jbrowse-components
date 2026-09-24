import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiWaySyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'MultiWaySyntenyDisplay',
      displayName: 'Multi-way synteny display',
      configSchema,
      stateModel: () =>
        import('./model.ts').then(f => f.stateModelFactory(configSchema)),
      trackType: 'SyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazyWithPreload(
        () => import('./components/ReactComponent.tsx'),
      ),
    })
  })
}
