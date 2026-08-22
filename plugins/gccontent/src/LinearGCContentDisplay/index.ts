import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import linearGCContentDisplayConfigSchema from './configSchemaReferenceSequence.ts'
import linearGCContentTrackDisplayConfigSchema from './configSchemaTrack.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Both GC-content displays render the wiggle body (their models extend the wiggle
// model factory). That export is already a `lazy()` component, so it needs no
// local bridge module here to stay out of cold load — the boundary lives at its
// definition site, which is the only place that can actually keep the wiggle
// shader source out of the eager chunk.

// Both displays share every slot (see sharedConfigSchema); they differ only in
// which track type they attach to and how they resolve their adapter, so each
// per-type config is an empty schema deriving from the shared one — identical
// types, which is what lets the single `LinearGCContentDisplayConfigSchema`
// below serve both state models.
//
// They are two annotated files rather than one `makeConfigSchema(name)` helper
// because the doc generator keys a `#config` block to its file: with the schemas
// built from one un-annotated helper, neither registered display type had a page
// at all. `SharedGCContentDisplay` had the only page, and — being the only
// documented name — its slot table told readers to write
// `type: 'SharedGCContentDisplay'`, which nothing accepts. Both displays were
// also missing from the "settings with a session-wide default" table
// (`agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md`), though their promotable
// `lineWidth`/`scatterPointSize` pins have always worked.

export type LinearGCContentDisplayConfigSchema = ReturnType<
  typeof linearGCContentDisplayConfigSchema
>

export default function LinearGCContentDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = linearGCContentDisplayConfigSchema()
    return new DisplayType({
      name: 'LinearGCContentDisplay',
      configSchema,
      // lazily loaded: both models compose the wiggle display model, which is
      // itself lazy, so a static edge here would pull that subgraph back into
      // the eager bundle
      stateModel: () =>
        import('./stateModelReferenceSequence.ts').then(f =>
          f.default(pluginManager, configSchema),
        ),
      displayName: 'GC content display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })

  pluginManager.addDisplayType(() => {
    const configSchema = linearGCContentTrackDisplayConfigSchema()
    return new DisplayType({
      name: 'LinearGCContentTrackDisplay',
      configSchema,
      stateModel: () =>
        import('./stateModelTrack.ts').then(f =>
          f.default(pluginManager, configSchema),
        ),
      displayName: 'GC content display',
      trackType: 'GCContentTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
