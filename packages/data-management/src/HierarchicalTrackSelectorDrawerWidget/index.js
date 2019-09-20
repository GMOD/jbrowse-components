import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const ReactComponent = import('./components/HierarchicalTrackSelector')
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema(
  'HierarchicalTrackSelectorDrawerWidget',
  {},
)
