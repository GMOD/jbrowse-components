import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { assembleLocString, toLocale } from '@jbrowse/core/util'
import { linearAlignmentsDisplayConfigSchemaFactory } from '@jbrowse/plugin-alignments'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

/**
 * #config LGVSyntenyDisplay
 * extends config
 * - [LinearAlignmentsDisplay](../linearalignmentsdisplay)
 */
function configSchemaF(pluginManager: PluginManager) {
  pluginManager.jexl.addFunction('lgvSyntenyTooltip', (f: Feature) => {
    const mate = f.get('mate')
    const l1name = f.get('name') || f.get('id')
    const l2name = mate?.name || mate?.id
    return [
      l1name ? `Name1: ${l1name}` : '',
      l2name ? `Name2: ${l2name}` : '',
      `Loc1: ${assembleLocString({
        refName: f.get('refName'),
        start: f.get('start'),
        end: f.get('end'),
      })} (${toLocale(f.get('end') - f.get('start'))}bp)`,
      `Loc2: ${assembleLocString({
        refName: mate.refName,
        start: mate.start,
        end: mate.end,
      })} (${toLocale(mate.end - mate.start)}bp)`,
    ]
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
      baseConfiguration: linearAlignmentsDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
