import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config FromConfigAdapter
 */
export const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    /**
     * !slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    /**
     * !slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true, implicitIdentifier: 'adapterId' },
)

/**
 * !config FromConfigRegionsAdapter
 * used for specifying refNames+sizes of an assembly
 */
export const regionsConfigSchema = ConfigurationSchema(
  'FromConfigRegionsAdapter',
  {
    /**
     * !slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    /**
     * !slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  {
    explicitlyTyped: true,
    implicitIdentifier: 'adapterId',
  },
)

/**
 * !config FromConfigSequenceAdapter
 */
export const sequenceConfigSchema = ConfigurationSchema(
  'FromConfigSequenceAdapter',
  {
    /**
     * !slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
    /**
     * !slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    },
  },
  { explicitlyTyped: true, implicitIdentifier: 'adapterId' },
)
