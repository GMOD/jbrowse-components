import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { triangleMatrixConfigSchemaFields } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LDTrackDisplay
 * #category display
 *
 * Linkage disequilibrium heatmap read from an `LDTrack`'s pre-computed file —
 * PLINK `--r2` output and the formats that follow it. JBrowse does not compute
 * LD from genotypes; run plink (or an equivalent) and point this at the result.
 *
 * #example
 * ```js
 * {
 *   type: 'LDTrack',
 *   trackId: 'ld',
 *   name: 'Linkage disequilibrium',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'PlinkLDTabixAdapter',
 *     uri: 'https://example.com/plink.ld.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LDTrackDisplay',
 *       displayId: 'ld-LDTrackDisplay',
 *       showLegend: true,
 *     },
 *   ],
 * }
 * ```
 */
export default function ldTrackDisplayConfigSchema() {
  return ConfigurationSchema(
    'LDTrackDisplay',
    {
      ...trackHeightConfigSchemaFields({
        defaultHeight: 400,
        height:
          'default height of the display, the band above the triangle included',
      }),
      ...triangleMatrixConfigSchemaFields,
      /**
       * #slot
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 100,
        description:
          'height of the band above the triangle holding the connector lines and labels',
        advanced: true,
      },
      /**
       * #slot
       * Which of the file's columns to draw: 'r2' (R², the R2/PHASED_R2 column)
       * or 'dprime' (D', the DP/ABS_DPRIME one). A file that carries only one of
       * the two serves that one whichever is asked for, and reports which
       * through the legend.
       */
      ldMetric: {
        type: 'stringEnum',
        model: types.enumeration('LDMetric', ['r2', 'dprime']),
        defaultValue: 'r2',
      },
      /**
       * #slot
       * Maximum separation, in variants, between the two SNPs of a drawn pair.
       * Pairs further apart are dropped, which turns the matrix from n²/2 cells
       * into n·k. This is plink's `--ld-window`, and a file plink wrote is
       * usually already windowed, so it most often drops nothing. Set to 0 to
       * draw every pair the file names.
       */
      maxVariantSeparation: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
      },
      /**
       * #slot
       */
      showVerticalGuides: {
        type: 'boolean',
        defaultValue: true,
        description:
          "on hover, draw guides across the view at the pair's genomic positions",
        advanced: true,
      },
      /**
       * #slot
       */
      showLabels: {
        type: 'boolean',
        defaultValue: false,
        description: 'show variant labels above the tick marks',
        advanced: true,
      },
      /**
       * #slot
       */
      tickHeight: {
        type: 'number',
        defaultValue: 6,
        description: 'height of the tick marks at the genomic positions',
        advanced: true,
      },
      /**
       * #slot
       * `'columns'` draws every SNP one uniform square wide; `'genomic'` sizes
       * the cells by the genomic distance between SNPs. The multi-sample
       * variant display takes the same slot for the same choice.
       */
      variantLayout: {
        type: 'stringEnum',
        model: types.enumeration('VariantLayout', ['genomic', 'columns']),
        defaultValue: 'columns',
        advanced: true,
      },
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
    },
  )
}

export type LDDisplayConfigSchema = ReturnType<
  typeof ldTrackDisplayConfigSchema
>
export type LDDisplayConfigModel = Instance<LDDisplayConfigSchema>
