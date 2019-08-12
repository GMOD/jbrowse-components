import { readConfObject, getConf } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { getSession } from '@gmod/jbrowse-core/util'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { getParent, types } from 'mobx-state-tree'
import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'

export { default as ReactComponent } from './components/AlignmentView'

export function stateModelFactory(pluginManager) {
  return types
    .model('AlignmentView', {
      id: ElementId,
      type: types.literal('AlignmentView'),
      views: types.array(
        pluginManager.getElementType('view', 'LinearGenomeView').stateModel,
      ),
      displayName: types.maybe(types.string),
      reversed: false,
      hideControls: false,
    })
    .actions(self => ({
      setDisplayName(name) {
        self.displayName = name
      },

      setViews(views) {
        self.views = views
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      activateConfigurationUI() {
        getSession(self).editConfiguration(self.configuration)
      },
    }))
}
