import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import sharedGCContentConfigSchema from './sharedConfigSchema.ts'
import stateModelReferenceSequenceF from './stateModelReferenceSequence.ts'
import stateModelTrackF from './stateModelTrack.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Both GC-content displays render the wiggle body (their models extend the wiggle
// model factory). That export is already a `lazy()` component, so it needs no
// local bridge module here to stay out of cold load — the boundary lives at its
// definition site, which is the only place that can actually keep the wiggle
// shader source out of the eager chunk.

// both displays share every slot (see sharedConfigSchema); they only differ in
// which track type they attach to and how they resolve their adapter, so the
// per-type config is just an empty schema deriving from the shared one
function makeConfigSchema(name: string) {
  return ConfigurationSchema(
    name,
    {},
    {
      baseConfiguration: sharedGCContentConfigSchema(),
      explicitlyTyped: true,
    },
  )
}

export type LinearGCContentDisplayConfigSchema = ReturnType<
  typeof makeConfigSchema
>

export default function LinearGCContentDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = makeConfigSchema('LinearGCContentDisplay')
    return new DisplayType({
      name: 'LinearGCContentDisplay',
      configSchema,
      stateModel: stateModelReferenceSequenceF(pluginManager, configSchema),
      displayName: 'GC content display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })

  pluginManager.addDisplayType(() => {
    const configSchema = makeConfigSchema('LinearGCContentTrackDisplay')
    return new DisplayType({
      name: 'LinearGCContentTrackDisplay',
      configSchema,
      stateModel: stateModelTrackF(pluginManager, configSchema),
      displayName: 'GC content display',
      trackType: 'GCContentTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
