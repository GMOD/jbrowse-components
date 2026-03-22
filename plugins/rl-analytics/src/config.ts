import { ConfigurationSchema } from '@jbrowse/core/configuration'

const configSchema = ConfigurationSchema('RLAnalyticsPlugin', {
  enabled: {
    type: 'boolean',
    defaultValue: true,
    description: 'Enable/disable the RL analytics plugin',
  },
  actionBufferSize: {
    type: 'number',
    defaultValue: 10000,
    description: 'Maximum number of actions to buffer before export',
  },
  debounceMs: {
    type: 'number',
    defaultValue: 100,
    description: 'Debounce window for continuous actions (ms)',
  },
  webhookUrl: {
    type: 'string',
    defaultValue: '',
    description: 'URL to POST action data to in real-time (empty = disabled)',
  },
  webhookBatchSize: {
    type: 'number',
    defaultValue: 50,
    description: 'Number of actions to batch per webhook POST',
  },
  webhookIntervalMs: {
    type: 'number',
    defaultValue: 5000,
    description: 'Maximum interval between webhook POSTs (ms)',
  },
  scavengerTasksUrl: {
    type: 'string',
    defaultValue: '',
    description: 'URL to fetch scavenger hunt task set JSON',
  },
  autoStartScavenger: {
    type: 'boolean',
    defaultValue: false,
    description: 'Auto-open scavenger hunt widget on session start',
  },
  rewardShaping: {
    type: 'string',
    defaultValue: 'potential',
    description: 'Reward shaping strategy: "potential", "sparse", or "dense"',
  },
  inactivityTimeoutMs: {
    type: 'number',
    defaultValue: 300000,
    description: 'Inactivity timeout for episode segmentation (ms)',
  },
  logUnknownPatches: {
    type: 'boolean',
    defaultValue: false,
    description: 'Log unclassified MST patches (for debugging/discovery)',
  },
})

export default configSchema
