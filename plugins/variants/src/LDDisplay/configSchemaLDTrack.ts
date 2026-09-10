import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
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
      /**
       * #slot
       * Height of the zone for connecting lines at the top
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 100,
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
       * Whether to show the legend. Defaults to off.
       */
      showLegend: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * Whether to show the LD triangle heatmap
       */
      showLDTriangle: {
        type: 'boolean',
        defaultValue: true,
      },
      /**
       * #slot
       * When true, squash the LD triangle to fit the display height
       */
      squashToHeight: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
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
       * Whether to show vertical guides at the connected genome positions on hover
       */
      showVerticalGuides: {
        type: 'boolean',
        defaultValue: true,
        advanced: true,
      },
      /**
       * #slot
       * Whether to show variant labels above the tick marks
       */
      showLabels: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      },
      /**
       * #slot
       * Height of the vertical tick marks at the genomic position
       */
      tickHeight: {
        type: 'number',
        defaultValue: 6,
        advanced: true,
      },
      /**
       * #slot
       * When true, draw cells sized according to genomic distance between SNPs
       * rather than uniform squares
       */
      useGenomicPositions: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      },
      /**
       * #slot
       * Starting height in pixels for the LD triangle, excluding the
       * lineZoneHeight band; drag-resizable
       */
      // An override of BaseLinearDisplay's `height` (100), which per the
      // slot-merge rule states only what differs — but `type` and
      // `defaultValue` stay, since they are what mark the entry as a slot.
      height: {
        type: 'number',
        defaultValue: 400,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LDDisplayConfigSchema = ReturnType<
  typeof ldTrackDisplayConfigSchema
>
export type LDDisplayConfigModel = Instance<LDDisplayConfigSchema>
