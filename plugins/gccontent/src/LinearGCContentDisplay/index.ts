import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import linearGCContentDisplayConfigSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearGCContentDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = linearGCContentDisplayConfigSchema()
    return new DisplayType({
      name: 'LinearGCContentDisplay',
      configSchema,
      // lazily loaded: the model composes the wiggle display model, which is
      // itself lazy, so a static edge here would pull that subgraph back into
      // the eager bundle
      stateModel: () =>
        import('./stateModel.tsx').then(f =>
          f.default(pluginManager, configSchema),
        ),
      displayName: 'GC content display',
      trackType: ['ReferenceSequenceTrack', 'GCContentTrack'],
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
      retiredTypes: [{ type: 'LinearGCContentTrackDisplay' }],
    })
  })
}
