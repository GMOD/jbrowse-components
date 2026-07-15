import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const BaseLinearDisplayComponent = lazy(
  () => import('./components/BaseLinearDisplayComponent.ts'),
)

export default function LinearWiggleDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearWiggleDisplay',
        displayName: 'Wiggle display',
        configSchema,
        stateModel: stateModelFactory(pluginManager, configSchema),
        trackType: 'QuantitativeTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }),
  )
}

export { default as ReactComponent } from './components/WiggleComponent.tsx'
export { default as modelFactory } from './model.ts'
export { default as configSchema } from './configSchema.ts'
