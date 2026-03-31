import { ConfigurationSchema } from '@jbrowse/core/configuration'

const configSchema = ConfigurationSchema('RLAnalyticsPlugin', {
  actionBufferSize: {
    type: 'number',
    defaultValue: 10000,
    description: 'Maximum number of actions to buffer',
  },
  debounceMs: {
    type: 'number',
    defaultValue: 500,
    description: 'Debounce window for merging rapid actions (ms)',
  },
  inactivityTimeoutMs: {
    type: 'number',
    defaultValue: 300000,
    description: 'Inactivity timeout for episode segmentation (ms)',
  },
  maxEpisodes: {
    type: 'number',
    defaultValue: 100,
    description: 'Maximum completed episodes to keep in memory',
  },
  logOtherActions: {
    type: 'boolean',
    defaultValue: false,
    description: 'Log unclassified MST actions (for debugging/discovery)',
  },
  webhookUrl: {
    type: 'string',
    defaultValue: '',
    description: 'URL to POST action data to in real-time (empty = disabled)',
  },
})

export default configSchema
