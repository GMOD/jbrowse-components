import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const ReactComponent = import('./components/AddConnectionDrawerWidget')
export { default as stateModel } from './model'
export const configSchema = ConfigurationSchema('AddConnectionDrawerWidget', {})
