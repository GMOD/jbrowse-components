import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { assembleLocString, toLocale } from '@jbrowse/core/util'
import { linearAlignmentsDisplayConfigSchemaFactory } from '@jbrowse/plugin-alignments'

import { getMate } from './components/util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

/**
 * #config LGVSyntenyDisplay
 *
 * #example
 * Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
 * two-row synteny view). Same track config as a synteny track — just pick this
 * display type:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LGVSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function configSchemaF(pluginManager: PluginManager) {
  pluginManager.jexl.addFunction('lgvSyntenyTooltip', (f: Feature) => {
    const mate = getMate(f)

    const l1name = f.get('name') || f.get('id')
    const l2name = mate.name || mate.id
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
      .filter(Boolean)
      .join('<br/>')
  })
  return ConfigurationSchema(
    'LGVSyntenyDisplay',
    {
      /**
       * #slot
       * Tooltip shown on hovering a synteny feature; the default jexl expression
       * renders both mates' names and locations.
       */
      mouseover: {
        type: 'string',
        defaultValue: 'jexl:lgvSyntenyTooltip(feature)',
      },
      /**
       * #slot
       * Synteny reads are strand-colored by default (vs the base alignments
       * display's `normal`); overrides the inherited `colorBy` slot's default.
       */
      colorBy: {
        type: 'frozen',
        defaultValue: { type: 'strand' },
        description: 'Color scheme for synteny reads',
        advanced: true,
      },
      /**
       * #slot
       * Synteny reads hide the coverage histogram by default; overrides the
       * inherited base alignments display's `showCoverage` default of `true`.
       */
      showCoverage: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw the coverage histogram band',
      },
      /**
       * #slot
       * Synteny lays large alignments out first so big syntenic blocks cluster
       * at the top instead of interleaving with small ones; overrides the base
       * alignments display's `largeFeaturesFirst` default of `false`.
       */
      largeFeaturesFirst: {
        type: 'boolean',
        defaultValue: true,
        description: 'Lay out large features first, in the lowest pileup rows',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration:
        linearAlignmentsDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF

export type LGVSyntenyDisplayConfigModel = ReturnType<typeof configSchemaF>
