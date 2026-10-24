import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  alleleFilterProblems,
  coverageAllelesConfigSchema,
} from './coverageAllelesConfigSchema.ts'
import { coverageEncodingConfigSchema } from './coverageEncodingConfigSchema.ts'
import {
  coverageInterbaseConfigSchema,
  interbaseFilterProblems,
} from './coverageInterbaseConfigSchema.ts'

import type { YScalePaths } from '@jbrowse/wiggle-core'

export {
  alleleFilterProblems,
  alleleFloorOf,
  withAlleleFloor,
} from './coverageAllelesConfigSchema.ts'
export {
  DEFAULT_INTERBASE_INDICATOR_RULE,
  interbaseFilterProblems,
  interbaseIndicatorRuleOf,
} from './coverageInterbaseConfigSchema.ts'
export { layerFilterProblems } from './layerFilterProblems.ts'
export type { LayerFilterField } from './layerFilterProblems.ts'
export type { InterbaseIndicatorRule } from './coverageInterbaseConfigSchema.ts'

/**
 * #config CoverageBand
 * #category display
 * The coverage histogram band of the alignments and MAF displays, their
 * `coverage` setting: whether it draws, its height, the insertion and clip
 * marks drawn in it (`interbase`), which allele segments it colors
 * (`alleles`), and its depth axis, `encoding.y`. On the alignments display,
 * the modification bars in it follow the pileup's `bases` layer, which
 * draws them beside its cells from the same calls.
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
     * The insertion and clip marks between bases: `show`, and the `filter`
     * deciding which positions get an indicator triangle.
     */
    interbase: coverageInterbaseConfigSchema,
    /**
     * #slot alleles
     * The colored allele segments: `show`, and the `filter` on each one's
     * `fraction`.
     */
    alleles: coverageAllelesConfigSchema,
  },
  {
    closed: true,
    plot: true,
    retired: {
      minAlleleFraction: gte => ({
        alleles: { filter: [{ field: 'fraction', gte }] },
      }),
    },
  },
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

/** The coverage band's layer filter entries its layers cannot apply. */
export function coverageLayerProblems(coverage: {
  interbase: { filter: unknown }
  alleles: { filter: unknown }
}) {
  return [
    ...interbaseFilterProblems(coverage.interbase.filter),
    ...alleleFilterProblems(coverage.alleles.filter),
  ]
}
