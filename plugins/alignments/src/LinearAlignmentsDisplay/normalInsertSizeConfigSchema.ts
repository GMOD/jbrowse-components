import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config NormalInsertSize
 * #category display
 * The alignments display's `normalInsertSize` setting: the insert sizes a
 * proper pair counts as `normal`, which every reader of
 * `insertSizeAndOrientation` classifies by, the read fills, the connections
 * and the hover. Both ends pin the band together; unset, each region's band
 * is sampled from its own pairs. Recoloring a level is `encoding.color`'s.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   normalInsertSize: { min: 150, max: 600 },
 *   encoding: {
 *     color: {
 *       field: 'insertSizeAndOrientation',
 *       scale: { domain: ['long', 'RL'], range: ['#d62728', '#17becf'] },
 *     },
 *   },
 * }
 * ```
 */
export const normalInsertSizeConfigSchema = ConfigurationSchema(
  'NormalInsertSize',
  {
    /**
     * #slot
     */
    min: {
      type: 'maybeNumber',
      description:
        'the shortest insert in bp a pair counts as normal; shorter is short',
    },
    /**
     * #slot
     */
    max: {
      type: 'maybeNumber',
      description:
        'the longest insert in bp a pair counts as normal; longer is long',
    },
  },
)

type NormalInsertSizeConfig = Instance<typeof normalInsertSizeConfigSchema>

function endsOf(conf: NormalInsertSizeConfig) {
  const min: number | undefined = readConfObject(conf, 'min')
  const max: number | undefined = readConfObject(conf, 'max')
  return { min, max }
}

/** The band `normalInsertSize` pins, undefined while the sampled band decides. */
export function pinnedInsertSizeBandOf(conf: NormalInsertSizeConfig) {
  const { min, max } = endsOf(conf)
  return min !== undefined && max !== undefined && min < max
    ? { lower: min, upper: max }
    : undefined
}

/** What `normalInsertSize` says that pins no band. */
export function normalInsertSizeProblems(conf: NormalInsertSizeConfig) {
  const { min, max } = endsOf(conf)
  return min === undefined && max === undefined
    ? []
    : min === undefined || max === undefined
      ? [
          `normalInsertSize: pins the band with both min and max; with ${min === undefined ? 'min' : 'max'} unset each region's band is sampled from its pairs`,
        ]
      : min < max
        ? []
        : [
            `normalInsertSize: min (${min}) is not below max (${max}), so each region's band is sampled from its pairs`,
          ]
}
