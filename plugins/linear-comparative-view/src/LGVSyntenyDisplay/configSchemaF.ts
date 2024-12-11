import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearPileupDisplayConfigSchemaFactory } from '@jbrowse/plugin-alignments'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

/**
 * #config LGVSyntenyDisplay
 * extends config
 * - [LinearPileupDisplay](../linearpileupdisplay)
 */
function configSchemaF(pluginManager: PluginManager) {
  pluginManager.jexl.addFunction('lgvSyntenyTooltip', (f: Feature) => {
    const m = f.get('mate')
    return [f.get('name') || f.get('id'), m?.name || m?.id]
      .filter(f => !!f)
      .join('<br/>')
  })
  return ConfigurationSchema(
    'LGVSyntenyDisplay',
    {
      mouseover: {
        type: 'string',
        defaultValue: 'jexl:lgvSyntenyTooltip(feature)',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearPileupDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
