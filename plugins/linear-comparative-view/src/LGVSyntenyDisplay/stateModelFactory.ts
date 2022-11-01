import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearBasicDisplay`, displays location of "synteny" features in a
 * plain LGV, allowing linking out to external synteny views
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types.compose(
    'LGVSyntenyDisplay',
    linearBasicDisplayModelFactory(schema),
    types.model({
      /**
       * #property
       */
      type: types.literal('LGVSyntenyDisplay'),
      /**
       * #property
       */
      configuration: ConfigurationReference(schema),
    }),
  )
}

export default stateModelFactory
