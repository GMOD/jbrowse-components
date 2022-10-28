import { ConfigurationSchema } from '@jbrowse/core/configuration'

export { default as ReactComponent } from './components/JobsListWidget'
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('JobsListWidget', {})
