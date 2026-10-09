import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  LAYOUT_ORDERS,
  linearAlignmentsDisplayConfigSchemaFactory,
} from '@jbrowse/plugin-alignments'
import { lodModeSlot } from '@jbrowse/synteny-core'

import { lgvSyntenyColorConfigSchema } from './lgvSyntenyColorConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

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
  return ConfigurationSchema(
    'LGVSyntenyDisplay',
    {
      ...lodModeSlot,
      /**
       * #slot color
       * The alignments displays' `color` object with `field` defaulting to
       * `strand`, where the base display paints the plain fill.
       */
      color: lgvSyntenyColorConfigSchema,
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
       * alignments display's `position` default.
       */
      layoutOrder: {
        type: 'stringEnum',
        model: types.enumeration('LayoutOrder', [...LAYOUT_ORDERS]),
        defaultValue: 'length',
        description:
          'Row order where no sort applies: by start (position), widest first (length), or spliced first (spliced)',
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
