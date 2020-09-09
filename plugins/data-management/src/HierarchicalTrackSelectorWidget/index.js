import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as ReactComponent } from './components/HierarchicalTrackSelector'
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema(
  'HierarchicalTrackSelectorWidget',
  {},
)
