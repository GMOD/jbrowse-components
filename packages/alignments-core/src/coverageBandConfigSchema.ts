import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { coverageEncodingConfigSchema } from './coverageEncodingConfigSchema.ts'
import { coverageInterbaseConfigSchema } from './coverageInterbaseConfigSchema.ts'

import type { YScalePaths } from '@jbrowse/wiggle-core'

/**
 * #config CoverageBand
 * #category display
 * The coverage histogram band of the alignments and MAF displays, their
 * `coverage` setting: whether it draws, its height, the insertion and clip
 * marks drawn in it, which allele segments it colors, and its depth axis,
 * `encoding.y`.
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
     * #slot encoding
     * The depth axis, `encoding.y`: its `scale`, `axis` and `rules`.
     */
    encoding: coverageEncodingConfigSchema,
    /**
     * #slot interbase
     * The insertion and clip marks between bases: `show`.
     */
    interbase: coverageInterbaseConfigSchema,
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

const Y = ['coverage', 'encoding', 'y'] as const

/**
 * Where the y scale's members live on a display mounting this band at
 * `coverage`. Each such display checks the paths against its own schema.
 */
export const COVERAGE_Y_PATHS = {
  members: {
    type: [...Y, 'scale', 'type'],
    zero: [...Y, 'scale', 'zero'],
    domainMin: [...Y, 'scale', 'domainMin'],
    domainMax: [...Y, 'scale', 'domainMax'],
    fence: [...Y, 'scale', 'fenceQuantile'],
    constant: [...Y, 'scale', 'constant'],
    group: [...Y, 'scale', 'group'],
    title: [...Y, 'axis', 'title'],
    grid: [...Y, 'axis', 'grid'],
    rules: [...Y, 'rules'],
  },
  reset: [Y],
} as const satisfies YScalePaths
