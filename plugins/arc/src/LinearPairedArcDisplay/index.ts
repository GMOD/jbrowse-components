import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearPairedArcDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearPairedArcDisplay',
      displayName: 'Variant display arcs',
      helpText:
        'Can display arcs connecting SVs and breakends in VCF format or BEDPE pairs',
      configSchema,
      // lazily loaded: fetched when a track picks this display or a session
      // names it
      stateModel: () =>
        import('./model.ts').then(f => f.stateModelFactory(configSchema)),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazyWithPreload(
        () => import('./components/ReactComponent.tsx'),
      ),
    })
  })
}
