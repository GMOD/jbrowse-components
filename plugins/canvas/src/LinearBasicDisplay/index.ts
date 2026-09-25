import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchemaFactory from './configSchema.ts'
import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LinearBasicDisplayComponent = lazyWithPreload(
  () => import('./components/FeatureComponent.tsx'),
)

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearBasicDisplay',
      displayName: 'Feature display',
      helpText:
        'GPU-accelerated feature display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      // Nothing eager may hold a static edge into './model.ts' or
      // './baseModel.ts'; the subpath exports in package.json are how a
      // display outside this plugin builds on either.
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearBasicDisplayComponent,
      // #region migration
      retiredTypes: [{ type: 'LinearFeatureDisplay' }],
      retiredConfig: migrateBasicConfigSnapshot,
      // #endregion
    })
  })
}

export { default as linearBasicDisplayConfigSchemaFactory } from './configSchema.ts'
export { default as linearCanvasBaseDisplayConfigSchemaFactory } from './baseConfigSchema.ts'
export type { LinearBasicDisplayModel } from './model.ts'
export type { LinearCanvasBaseDisplayModel } from './baseModel.ts'
