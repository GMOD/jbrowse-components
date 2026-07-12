import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import sharedGCContentConfigSchema from './sharedConfigSchema.ts'
import stateModelReferenceSequenceF from './stateModelReferenceSequence.ts'
import stateModelTrackF from './stateModelTrack.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LazyWiggleDisplayComponent = lazy(
  () => import('./components/WiggleDisplayComponent.ts'),
)

// both displays share every slot (see sharedConfigSchema); they only differ in
// which track type they attach to and how they resolve their adapter, so the
// per-type config is just an empty schema deriving from the shared one
function makeConfigSchema(pluginManager: PluginManager, name: string) {
  return ConfigurationSchema(
    name,
    {},
    {
      baseConfiguration: sharedGCContentConfigSchema(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default function LinearGCContentDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = makeConfigSchema(pluginManager, 'LinearGCContentDisplay')
    return new DisplayType({
      name: 'LinearGCContentDisplay',
      configSchema,
      stateModel: stateModelReferenceSequenceF(pluginManager, configSchema),
      displayName: 'GC content display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyWiggleDisplayComponent,
    })
  })

  pluginManager.addDisplayType(() => {
    const configSchema = makeConfigSchema(
      pluginManager,
      'LinearGCContentTrackDisplay',
    )
    return new DisplayType({
      name: 'LinearGCContentTrackDisplay',
      configSchema,
      stateModel: stateModelTrackF(pluginManager, configSchema),
      displayName: 'GC content display',
      trackType: 'GCContentTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyWiggleDisplayComponent,
    })
  })
}
