import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchemaFactory1 from './config1.ts'
import configSchemaFactory2 from './config2.ts'
import stateModelF1 from './stateModel1.ts'
import stateModelF2 from './stateModel2.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LazyWiggleDisplayComponent = lazy(() =>
  import('@jbrowse/plugin-wiggle').then(m => ({
    default: m.LinearWiggleDisplayReactComponent,
  })),
)

export default function LinearGCContentDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory1(pluginManager)
    const stateModel = stateModelF1(pluginManager, configSchema)
    return new DisplayType({
      name: 'LinearGCContentDisplay',
      configSchema,
      stateModel,
      displayName: 'GC content display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyWiggleDisplayComponent,
    })
  })

  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory2(pluginManager)
    const stateModel = stateModelF2(pluginManager, configSchema)
    return new DisplayType({
      name: 'LinearGCContentTrackDisplay',
      configSchema,
      stateModel,
      displayName: 'GC content display',
      trackType: 'GCContentTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyWiggleDisplayComponent,
    })
  })
}
