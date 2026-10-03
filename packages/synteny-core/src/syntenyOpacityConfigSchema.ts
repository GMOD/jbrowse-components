import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { normalizeChannel } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * `scale` on a synteny opacity object: `none` draws `value` and keeps the
 * field for a switch back, as it does on `color`; `threshold` reads `domain`
 * as cut points. Unset, a field's type decides: a number column fades along
 * `range`, a text column takes `range` per label in `domain`.
 */
export const SYNTENY_OPACITY_SCALES = ['none', 'threshold'] as const

export type SyntenyOpacityScale = (typeof SYNTENY_OPACITY_SCALES)[number]

/** A synteny opacity object as its snapshot holds it. */
export interface SyntenyOpacitySnapshot {
  value?: number
  field?: string
  scale?: SyntenyOpacityScale
  domain?: readonly string[]
  range?: readonly string[]
  domainMin?: number
  domainMax?: number
}

/**
 * #config SyntenyOpacity
 * #category view
 * The synteny views' `opacity` setting, as `color` is their colour: one
 * opacity for every alignment, or a field each alignment carries read into
 * opacities. A number is the constant and lands in `value`; a string is the
 * field and lands in `field`. Under a field, `range` holds the opacities
 * themselves, so a field that fades a dense view keeps it dim by writing a
 * low range.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', opacity: 0.3 }
 * ```
 * ```js
 * { type: 'LinearSyntenyView', opacity: { field: 'identity', range: [0.1, 0.6] } }
 * ```
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   opacity: {
 *     field: 'break_FET',
 *     scale: 'threshold',
 *     domain: [0.05],
 *     range: [0.8, 0.15],
 *   },
 * }
 * ```
 */
export const syntenyOpacityConfigSchema = ConfigurationSchema(
  'SyntenyOpacity',
  {
    /**
     * #slot value
     * The opacity of every alignment, 0 to 1, while no field fades them.
     * Unset is the view's own default. Writing `opacity: 0.3` lands here.
     */
    value: {
      type: 'maybeNumber',
      description: "every alignment's opacity; unset is the view's default",
    },
    /**
     * #slot field
     * What fades an alignment: a measurement (`identity`, `mapq`, `dnds`) or
     * a column the tracks declare in `attributeColumns`. Empty draws every
     * alignment at `value`. Writing `opacity: "identity"` lands here.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'measurement or attributeColumns column; empty is value',
    },
    /**
     * #slot scale
     * `none` draws `value` and keeps the field for a switch back;
     * `threshold` reads `domain` as cut points, a value on a cut taking the
     * interval above it. Unset, a number column fades linearly from
     * `domainMin` to `domainMax` and a text column takes one opacity per
     * label.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('SyntenyOpacityScale', [
        ...SYNTENY_OPACITY_SCALES,
      ]),
      description: 'none, threshold, or unset to follow the field',
    },
    /**
     * #slot domain
     * A text column's labels, which take `range` in order; under
     * `threshold`, the cut points.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'labels, or threshold cut points',
    },
    /**
     * #slot range
     * The opacities, 0 to 1: a number column's at `domainMin` and
     * `domainMax`, a text column's per `domain` label, a threshold's per
     * interval, one more than the cuts. Empty fades a number column from 0.3
     * to 1; a label or interval past the list draws opaque.
     */
    range: {
      type: 'stringArray',
      defaultValue: [],
      description: 'opacities along the domain',
    },
    /**
     * #slot domainMin
     * The value a number column is faintest at; unset, the measurement's
     * own floor or the least value seen.
     */
    domainMin: {
      type: 'maybeNumber',
      description: 'value at the faintest end; unset follows the field',
    },
    /**
     * #slot domainMax
     * The value a number column is most opaque at; unset, the measurement's
     * own ceiling or the greatest value seen.
     */
    domainMax: {
      type: 'maybeNumber',
      description: 'value at the most opaque end; unset follows the field',
    },
  },
  {
    shorthand: ['value', 'field'],
    closed: true,
    // the range is written as the numbers it names and held as strings, the
    // way a threshold domain holds its cuts
    preProcessSnapshot: (snap: Record<string, unknown> = {}) => {
      const out = normalizeChannel(snap, 'opacity')
      return Array.isArray(out.range)
        ? { ...out, range: out.range.map(String) }
        : out
    },
  },
)

export type SyntenyOpacityConfigModel = typeof syntenyOpacityConfigSchema
