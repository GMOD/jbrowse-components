import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as stateModel } from './model'

export const configSchema = ConfigurationSchema('MainMenuBar', {})

export const ReactComponent = import('./components/MainMenuBar')
