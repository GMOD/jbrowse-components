import { ConfigurationSchema } from '@jbrowse/core/configuration'

export { default as ReactComponent } from './components/GridBookmarkWidget'
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('GridBookmarkWidget', {})
