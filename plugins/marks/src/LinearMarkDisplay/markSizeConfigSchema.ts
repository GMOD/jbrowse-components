import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SIZE_SCALES } from './markVocabulary.ts'

/**
 * #config MarkSize
 * #category display
 * A mark's size in px, as `color` is its color: a point's diameter, a rule's
 * thickness or a link's stroke. A number is the constant every instance
 * takes, and lands in `value`; a string is a feature field, and lands in
 * `field`, which a link reads through a linear or log scale into a px range,
 * so a score becomes a width the way a ramp makes it a color.
 *
 * #example
 * ```js
 * { mark: 'point', encoding: { y: 'score', size: 7 } }
 * ```
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
     * #slot value
     * The px every instance takes: a point's diameter, a rule's thickness, a
     * link's stroke where it reads no `field`. Unset is the mark's own, 4 for
     * a point or a rule and 2 for a link. Writing `size: 7` lands here.
     */
    value: {
      type: 'maybeNumber',
      description: "px for every instance; unset is the mark's own",
    },
    /**
     * #slot field
     * The feature field a link's width reads, or a jexl expression over
     * `feature`. Empty draws every instance at `value`. Writing
     * `size: "score"` lands here.
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
    shorthand: ['value', 'field'],
    closed: true,
    // A range is written as numbers, the px it names; the slot holds them as
    // strings the way a threshold domain holds its cuts.
    preProcessSnapshot: (snap: Record<string, unknown> = {}) =>
      Array.isArray(snap.range)
        ? { ...snap, range: snap.range.map(String) }
        : snap,
  },
)
