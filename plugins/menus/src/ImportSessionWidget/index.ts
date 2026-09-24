import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('ImportSessionWidget', {})

const stateModel = types.model('ImportSessionWidget', {
  id: ElementId,
  type: types.literal('ImportSessionWidget'),
})

export default function ImportSessionWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'ImportSessionWidget',
      heading: 'Import session',
      configSchema,
      stateModel,
      ReactComponent: lazyWithPreload(
        () => import('./components/ImportSessionWidget.tsx'),
      ),
    })
  })
}
