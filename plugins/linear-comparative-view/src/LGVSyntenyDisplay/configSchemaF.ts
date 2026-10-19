import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearAlignmentsDisplayConfigSchema } from '@jbrowse/plugin-alignments'
import { lodModeSlot } from '@jbrowse/synteny-core'

import { lgvSyntenyColorConfigSchema } from './lgvSyntenyColorConfigSchema.ts'
import { lgvSyntenyCoverageConfigSchema } from './lgvSyntenyCoverageConfigSchema.ts'
import { lgvSyntenySortConfigSchema } from './lgvSyntenySortConfigSchema.ts'

/**
 * #config LGVSyntenyDisplay
 * Draws a `SyntenyTrack`'s alignments in a linear genome view, stacked and
 * colored the way an alignments display draws reads. It has the alignments
 * display's bands and settings but the sashimi band, `filter.junctions`,
 * `baseColor` and `modifications`: a synteny block has no introns, basecaller
 * tags or qualities.
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
export default function configSchemaF() {
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
       * #slot coverage
       * The alignments displays' `coverage` band with `show` defaulting to
       * off: a synteny track hides the coverage histogram unless asked.
       */
      coverage: lgvSyntenyCoverageConfigSchema,
      /**
       * #slot
       * One row per facet section by default: an all-vs-all track faceted by
       * mate assembly draws each mate genome as a single band, with repeat
       * depth shown as darker shading rather than as extra rows. Overrides the
       * base alignments display's `collapseSections` default of `false`, where
       * a section is a read category and the stack itself is the information.
       */
      collapseSections: {
        type: 'boolean',
        defaultValue: true,
        description:
          'Draw each facet section as a single row rather than a stack',
      },
      /**
       * #slot
       * Hide the lane an all-vs-all track draws for the view's own assembly.
       * That lane has no self-alignment line, because aligners skip each
       * sequence's diagonal, so it shows only the assembly's internal paralogy,
       * which readers consistently read as missing data. Only meaningful when
       * grouping by mate assembly.
       */
      hideSelfAlignments: {
        type: 'boolean',
        defaultValue: false,
        description:
          "Hide the group matching the view's own assembly when grouping by mate assembly",
      },
      /**
       * #slot sort
       * The row order, with `length` the default so big syntenic blocks cluster at the top; a string is the `type`.
       */
      sort: lgvSyntenySortConfigSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearAlignmentsDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LGVSyntenyDisplayConfigModel = ReturnType<typeof configSchemaF>
