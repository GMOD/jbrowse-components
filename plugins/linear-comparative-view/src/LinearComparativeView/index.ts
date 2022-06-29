import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import modelFactory from './model'

export default ({ jbrequire }: PluginManager) => {
  return new ViewType({
    name: 'LinearComparativeView',
    stateModel: jbrequire(modelFactory),
    ReactComponent: lazy(() => import('./components/LinearComparativeView')),
  })
}
