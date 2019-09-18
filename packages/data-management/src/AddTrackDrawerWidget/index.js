import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const ReactComponent = import('./components/AddTrackDrawerWidget')
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('AddTrackDrawerWidget', {})
