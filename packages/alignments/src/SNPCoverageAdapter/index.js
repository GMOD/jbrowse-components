import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './SNPCoverageAdapter'

export const configSchema = ConfigurationSchema(
  'SNPAdapter',
  {
    subadapter: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)

// export function configSchema(pluginManager) {
//   return ConfigurationSchema(
//     'SNPAdapter',
//     {
//       subadapter: pluginManager.pluggableConfigSchemaType('adapter'),
//     },
//     { explicitlyTyped: true },
//   )
// }
