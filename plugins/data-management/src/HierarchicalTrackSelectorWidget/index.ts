import { lazy } from 'react'

import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui/Menu'
import type { AbstractSessionModel } from '@jbrowse/core/util'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'TrackSelector-multiTrackMenuItems': {
      args: MenuItem[]
      result: MenuItem[]
      props: { session: AbstractSessionModel }
    }
  }
}

export default function HierarchicalTrackSelectorWidgetF(
  pluginManager: PluginManager,
) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'HierarchicalTrackSelectorWidget',
      heading: 'Available tracks',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(
        () => import('./components/HierarchicalTrackSelector.tsx'),
      ),
    })
  })
}

export {
  type HierarchicalTrackSelectorModel,
  default as stateModelFactory,
} from './model.ts'
export { default as configSchema } from './configSchema.ts'
