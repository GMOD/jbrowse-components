import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const ReactComponent = import('./components/AddConnectionWidget')
export { default as stateModel } from './model'
export const configSchema = ConfigurationSchema('AddConnectionWidget', {})
