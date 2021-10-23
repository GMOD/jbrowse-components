import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import modelFactory from './model'

export default ({ jbrequire }: PluginManager) => {
  const ViewType = jbrequire('@jbrowse/core/pluggableElementTypes/ViewType')
  return new ViewType({
    name: 'LinearComparativeView',
    stateModel: jbrequire(modelFactory),
    ReactComponent: lazy(() => import('./components/LinearComparativeView')),
  })
}
