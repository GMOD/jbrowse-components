import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true },
)

export const regionsConfigSchema = ConfigurationSchema(
  'FromConfigRegionsAdapter',
  {
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true },
)

export const sequenceConfigSchema = ConfigurationSchema(
  'FromConfigSequenceAdapter',
  {
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },

    // occasionally assemblies may not be associated with the assemblyManager
    // e.g. in the case of the "read assembly" that is used in read vs ref
    // visualizations
    noAssemblyManager: {
      type: 'boolean',
      defaultValue: false,
    },
  },
  { explicitlyTyped: true },
)
