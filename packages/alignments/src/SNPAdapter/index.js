import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './SNPAdapter'

export const configSchema = ConfigurationSchema(
  'SNPAdapter',
  {
    // verify extension names
    snpLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.snp' },
    },
    craiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.snp.sni' },
    },
  },
  { explicitlyTyped: true },
)
