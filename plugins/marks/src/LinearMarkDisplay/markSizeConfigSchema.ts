import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SIZE_SCALES } from './markVocabulary.ts'

/**
 * #config MarkSize
 * #category display
 * A link mark's stroke width as a channel: a feature field read through a
 * linear or log scale into a px range, so a score becomes a width the way a
 * ramp makes it a colour. Writing a field name directly on the encoding lands
 * in `field`, on a linear scale over the default range.
 *
 * #example
 * ```js
 * {
 *   mark: 'link',
 *   encoding: { size: { field: 'score', scale: 'log', range: [1, 8] } },
 * }
 * ```
 */
export const markSizeSchema = ConfigurationSchema(
  'MarkSize',
  {
    /**
     * #slot field
     * The feature field the width reads, or a jexl expression over
     * `feature`. Empty draws every instance at the mark's own `size`.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'feature field, or jexl expression',
    },
    /**
     * #slot scale
     * How the value becomes a width: `linear` or `log` between `domainMin`
     * and `domainMax`.
     */
    scale: {
      type: 'stringEnum',
      model: types.enumeration('SizeScale', [...SIZE_SCALES]),
      defaultValue: 'linear',
      description: 'linear or log',
    },
    /**
     * #slot domainMin
     * The value the thinnest width stands at; unset, the loaded regions' own
     * least.
     */
    domainMin: {
      type: 'maybeNumber',
      description: 'value at the thinnest width; unset follows the regions',
    },
    /**
     * #slot domainMax
     * The value the widest width stands at; unset, the loaded regions' own
     * greatest.
     */
    domainMax: {
      type: 'maybeNumber',
      description: 'value at the widest width; unset follows the regions',
    },
    /**
     * #slot range
     * The px at each end of the domain, thinnest first. Empty is 1 to 6.
     */
    range: {
      type: 'stringArray',
      defaultValue: [],
      description: 'px at each end of the domain',
    },
  },
  {
    shorthand: 'field',
    closed: true,
    // A range is written as numbers, the px it names; the slot holds them as
    // strings the way a threshold domain holds its cuts.
    preProcessSnapshot: (snap: Record<string, unknown> = {}) =>
      Array.isArray(snap.range)
        ? { ...snap, range: snap.range.map(String) }
        : snap,
  },
)
