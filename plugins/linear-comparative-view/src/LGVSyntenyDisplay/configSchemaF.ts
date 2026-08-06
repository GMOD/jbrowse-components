import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { assembleLocString, toLocale } from '@jbrowse/core/util'
import { linearAlignmentsDisplayConfigSchemaFactory } from '@jbrowse/plugin-alignments'

import { getMate } from '../syntenyMate.ts'

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
  /** #jexlFunction Slot defaults from plugins | lgvSyntenyTooltip(feature) | both sides of a synteny feature, the LGVSyntenyDisplay's default mouseover */
  pluginManager.jexl.addFunction('lgvSyntenyTooltip', (f: Feature) => {
    const mate = getMate(f)
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
      // a mate-less feature (a non-synteny adapter under this display) still
      // gets a tooltip for its own side rather than an exception that swallows
      // the whole tooltip
      mate
        ? `Loc2: ${assembleLocString({
            refName: mate.refName,
            start: mate.start,
            end: mate.end,
          })} (${toLocale(mate.end - mate.start)}bp)`
        : '',
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
        // merges over the base alignments slot, so this states only what
        // differs — synteny falls back to `strand`, not `normal`. `validate` and
        // `advanced` are inherited. Restating `promotedBase` is also what keeps
        // the slot promotable, here and at the type level: declaring it is the
        // only marker. (`type`/`defaultValue` stay because they're what marks an
        // entry as a slot rather than a sub-schema.)
        type: 'maybeFrozen',
        defaultValue: undefined,
        promotedBase: { type: 'strand' },
        description: 'Color scheme for synteny reads',
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
       * One lane per group by default: an all-vs-all track grouped by mate
       * assembly draws each mate genome as a single band, with repeat depth
       * shown as darker shading rather than as extra rows. Overrides the base
       * alignments display's `collapseGroupRows` default of `false`, where a
       * group is a read category and the stack itself is the information.
       */
      collapseGroupRows: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw each group as a single row rather than a stack',
      },
      /**
       * #slot
       * Hide the lane an all-vs-all track draws for the view's own assembly.
       * That lane holds no self-alignment line — aligners skip each sequence's
       * own diagonal — so it carries only the assembly's internal paralogy, and
       * readers consistently read it as missing data. Only meaningful when
       * grouping by mate assembly.
       */
      hideSelfAlignments: {
        type: 'boolean',
        defaultValue: false,
        description:
          "Hide the group matching the view's own assembly when grouping by mate assembly",
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
