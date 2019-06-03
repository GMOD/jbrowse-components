import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export const reactComponent = import('./components/HierarchicalTrackSelector')
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema(
  'HierarchicalTrackSelectorDrawerWidget',
  {},
)
