import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import {
  colorChannelOptions,
  colorDomainSlot,
  colorLegendOptions,
  colorNamesSlot,
  colorRangeSlot,
  colorScaleOptions,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import {
  REF_NAME_RANK_PALETTE,
  REF_NAME_RANK_LABELS,
} from './components/refNameRanks.ts'
import { MAF_COLOR_FIELDS } from './rowPlan.ts'

import type { MafColorField } from './rowPlan.ts'
import type { FieldPresets } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * Each field's one scale and what it reads while the config leaves a member
 * unwritten.
 */
export const MAF_FIELD_PRESETS = {
  identity: {
    ...MEASURE_FIELD_PRESETS.identity,
    legend: { title: 'Per-base identity to reference' },
  },
  refNameRank: {
    scale: {
      type: 'ordinal',
      domain: REF_NAME_RANK_PALETTE.map((_, rank) => String(rank)),
      range: REF_NAME_RANK_PALETTE,
      names: REF_NAME_RANK_LABELS,
    },
    legend: { title: 'Source sequence' },
  },
} as const satisfies FieldPresets<'ordinal' | 'linear'> &
  Record<MafColorField, unknown>

/**
 * #config MafColor
 * #category display
 * The MAF display's `encoding.color`: what fills each species row's aligned
 * cells, as alignments' `encoding.color` fills its reads. Unset, the theme's
 * match tone fills them, and the X-Y plot's bars take its one bar color.
 * `value` is a constant fill. `identity` paints the mean identity to the
 * reference along a ramp, from `scale.domainMin` 0 to `scale.domainMax` 1
 * along the `redgreyblue` scheme, as every display's identity does.
 * `refNameRank` paints each block by the rank of its source sequence within
 * the row, rank 0 being the sequence the row aligns most bases from, so a
 * rearranged block stands out. A string is the field. The mismatches and the
 * per-base layer draw over the fill: `alignments.mismatches` and
 * `alignments.bases`.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', encoding: { color: 'identity' } }
 * ```
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   encoding: {
 *     color: { field: 'identity', scale: { domainMin: 0.7, scheme: 'viridis' } },
 *   },
 * }
 * ```
 * ```js
 * { type: 'LinearMafDisplay', encoding: { color: { value: '#ccc' } } }
 * ```
 */
export const mafColorConfigSchema = ConfigurationSchema(
  'MafColor',
  {
    /**
     * #slot value
     * The fill of every aligned cell, and of the X-Y plot's bars, while no
     * field paints.
     */
    value: {
      type: 'maybeColor',
      description:
        "CSS color of every aligned cell while no field paints; unset, the theme's match tone",
    },
    /**
     * #slot field
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('MafColorField', [...MAF_COLOR_FIELDS]),
      description:
        'field the aligned cells are filled by: identity or refNameRank; unset, the constant',
    },
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object. Each
     * field has one scale type, so the object names none.
     */
    scale: ConfigurationSchema(
      'MafColorScale',
      {
        ...colorDomainSlot({
          domain:
            'the ranks the key lists under refNameRank, in order, from 0, the main source sequence',
        }),
        ...colorRangeSlot({
          range:
            "CSS colors: under refNameRank one per rank from the main source sequence, the last painting every rank past it; under identity the ramp's stops, winning over scheme",
        }),
        ...colorNamesSlot,
        /**
         * #slot scale.scheme
         */
        scheme: {
          type: 'maybeStringEnum',
          model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
          description:
            "the named ramp identity runs along; unset is redgreyblue, and range's colors, where it lists any, win over it",
        },
        /**
         * #slot scale.reverse
         */
        reverse: {
          type: 'maybeBoolean',
          description:
            'turns the identity ramp round, so its last color paints the low end; unset runs as written',
        },
        /**
         * #slot scale.domainMin
         */
        domainMin: {
          type: 'maybeNumber',
          description:
            "the identity the ramp's low end paints, 0 to 1; unset is 0, and 0.7 spreads the ramp over close relatives",
        },
        /**
         * #slot scale.domainMax
         */
        domainMax: {
          type: 'maybeNumber',
          description: "the identity the ramp's high end paints; unset is 1",
        },
        /**
         * #slot scale.domainMid
         */
        domainMid: {
          type: 'maybeNumber',
          description:
            "the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it",
        },
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws; an unset `title` is the field's own
     * heading.
     */
    legend: ConfigurationSchema(
      'MafColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', MAF_FIELD_PRESETS),
)
