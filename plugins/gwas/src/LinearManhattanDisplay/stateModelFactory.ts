import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import TooltipComponent from './components/TooltipComponent.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const LinearManhattanDisplayComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent.tsx'),
)

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearManhattanDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(() => ({
      /**
       * #getter
       */
      get TooltipComponent() {
        return TooltipComponent
      },
      /**
       * #getter
       */
      get DisplayMessageComponent() {
        return LinearManhattanDisplayComponent
      },
    }))
}

export type LinearManhattanDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearManhattanDisplayModel = Instance<LinearManhattanDisplayStateModel>
