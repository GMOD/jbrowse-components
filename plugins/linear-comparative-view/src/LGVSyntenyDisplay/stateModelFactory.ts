import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { linearPileupDisplayStateModelFactory } from '@jbrowse/plugin-alignments'
import { types } from 'mobx-state-tree'

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearBasicDisplay`, displays location of "synteny" features in a
 * plain LGV, allowing linking out to external synteny views
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types.compose(
    'LGVSyntenyDisplay',
    linearPileupDisplayStateModelFactory(schema),
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
