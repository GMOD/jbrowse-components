import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'

import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types.compose(
    'LGVSyntenyDisplay',
    linearBasicDisplayModelFactory(configSchema),
    types.model({
      /**
       * #property
       */
      type: types.literal('LGVSyntenyDisplay'),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    }),
  )
}
