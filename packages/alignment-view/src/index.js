import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  ReactComponent as AlignmentViewReactComponent,
  stateModelFactory as alignmentViewStateModelFactory,
} from './AlignmentView'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'AlignmentView',
          stateModel: alignmentViewStateModelFactory(pluginManager),
          ReactComponent: AlignmentViewReactComponent,
        }),
    )
  }
}
