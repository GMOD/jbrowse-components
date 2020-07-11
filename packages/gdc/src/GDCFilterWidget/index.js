import { observer } from 'mobx-react'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const ReactComponent = import('./components/GDCFilterComponent')
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('GDCFilterWidget', {})
export const HeadingComponent = observer(() => {
  return 'GDC Filters'
})
