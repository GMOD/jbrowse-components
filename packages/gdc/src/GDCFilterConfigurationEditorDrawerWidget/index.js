import { observer } from 'mobx-react'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const ReactComponent = import('./components/ConfigurationEditor')
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema(
  'GDCFilterConfigurationEditorDrawerWidget',
  {},
)
export const HeadingComponent = observer(({ model }) => {
  return 'GDC Filters'
})
