import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { assembleLocStringFast, getBpDisplayStr } from '@jbrowse/core/util'
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
    const l1name = f.get('name') || f.get('id')
    const l2name = m?.name || m?.id
    const l1loc = assembleLocStringFast(
      {
        refName: f.get('refName'),
        start: f.get('start'),
        end: f.get('end'),
      },
      n => getBpDisplayStr(n),
    )
    const l2loc = assembleLocStringFast(
      {
        refName: m.refName,
        start: m.start,
        end: m.end,
      },
      n => getBpDisplayStr(n),
    )
    return [
      `Loc1: ${[l1name, l1loc].filter(f => !!f).join(' ')}`,
      `Loc2: ${[l2name, l2loc].filter(f => !!f).join(' ')}`,
    ].join('<br/>')
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
