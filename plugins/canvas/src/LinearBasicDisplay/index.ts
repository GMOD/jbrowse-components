import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'

import configSchemaFactory from './configSchema.ts'
import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LinearBasicDisplayComponent = lazy(
  () => import('./components/FeatureComponent.tsx'),
)

export default function register(pluginManager: PluginManager) {
  // geneGlyphMode "longest" and a boolean showLabels are legacy values on
  // existing enum slots, so normalize them before the display union validates
  // the snapshot (a config-schema preProcessSnapshot does not run there).
  // Matches the alias too, since this fires before alias normalization.
  addDisplayConfigMigration(
    pluginManager,
    ['LinearBasicDisplay', 'LinearFeatureDisplay'],
    migrateBasicConfigSnapshot,
  )
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearBasicDisplay',
      displayName: 'Feature display',
      helpText:
        'GPU-accelerated feature display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      // lazily loaded: the feature-display model and its layout math are the
      // largest eager subgraph in this plugin, and are fetched only when a
      // feature track is shown or a session names this display. Nothing eager
      // may hold a static edge into './model.ts' or './baseModel.ts' — the
      // subpath exports in package.json are how a display outside this plugin
      // builds on either.
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearBasicDisplayComponent,
      aliases: ['LinearFeatureDisplay'],
    })
  })
}

export { default as linearBasicDisplayConfigSchemaFactory } from './configSchema.ts'
export { default as linearCanvasBaseDisplayConfigSchemaFactory } from './baseConfigSchema.ts'
export type { LinearBasicDisplayModel } from './model.ts'
export type { LinearCanvasBaseDisplayModel } from './baseModel.ts'
