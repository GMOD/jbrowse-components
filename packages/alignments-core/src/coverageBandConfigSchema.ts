import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config CoverageBand
 * #category display
 * The coverage histogram band of the alignments and MAF displays, their
 * `coverage` setting: whether it draws, its height, the insertion and clip
 * marks drawn in it, and which allele segments it colors. Its value axis is
 * the display's `scales`.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { height: 80 } }
 * ```
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { show: false } }
 * ```
 */
export const coverageBandConfigSchema = ConfigurationSchema(
  'CoverageBand',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the coverage band',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 45,
      description: 'height of the coverage band in pixels',
    },
    /**
     * #slot
     */
    showInterbaseIndicators: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the insertion and clip count bars and their indicator triangles',
    },
    /**
     * #slot
     * A color rule, beside the pileup's `fadeLowFrequency`, which fades its
     * marks by the same per-base share through a depth-dependent threshold.
     * The band's grey depth bar shows through where a segment is not colored.
     */
    minAlleleFraction: {
      type: 'number',
      defaultValue: 0,
      description:
        "an allele segment colors only with at least this share of its position's depth; 0 colors every mismatch, sequencing errors included",
    },
  },
  { closed: true, plot: true },
)
