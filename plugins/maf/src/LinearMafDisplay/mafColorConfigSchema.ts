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
  SOURCE_CHROM_PALETTE,
  SOURCE_CHROM_RANK_LABELS,
} from './components/drawSourceChrom.ts'
import { MAF_COLOR_FIELDS } from './rowRenderings.ts'

import type { MafColorField } from './rowRenderings.ts'
import type { FieldPresets } from '@jbrowse/display-kit/colorConfigSchema'

const BASE_KEYS = ['A', 'C', 'G', 'T', 'N', 'gap'] as const

/**
 * Each field's one scale and what it reads while the config leaves a member
 * unwritten. The bases and the codons list no `range`, so they paint the
 * theme's colors.
 */
export const MAF_FIELD_PRESETS = {
  mismatch: {
    scale: { type: 'ordinal', domain: [...BASE_KEYS, 'match'] },
    legend: { title: 'Mismatch to reference' },
  },
  base: {
    scale: { type: 'ordinal', domain: BASE_KEYS },
    legend: { title: 'Base' },
  },
  identity: {
    ...MEASURE_FIELD_PRESETS.identity,
    legend: { title: 'Per-base identity to reference' },
  },
  chromosome: {
    scale: {
      type: 'ordinal',
      domain: SOURCE_CHROM_PALETTE.map((_, rank) => String(rank)),
      range: SOURCE_CHROM_PALETTE,
      names: SOURCE_CHROM_RANK_LABELS,
    },
    legend: { title: 'Source chromosome' },
  },
  codon: {
    scale: {
      type: 'ordinal',
      domain: ['nonsyn', 'syn', 'stop'],
      names: ['Nonsynonymous', 'Synonymous', 'Stop gained'],
    },
    legend: { title: 'Codon change' },
  },
} as const satisfies FieldPresets<'ordinal' | 'linear'> &
  Record<MafColorField, unknown>

/**
 * #config MafColor
 * #category display
 * The MAF display's `encoding.color` colors each species row's aligned cells
 * by one field.
 * `mismatch` paints a base only where it differs from the reference,
 * `base` every base, `identity` the mean identity to the reference along a
 * ramp, `chromosome` each block by the rank of its source chromosome within
 * the row, and `codon` each codon by its amino-acid change, given an
 * `framesAdapter`. A string is the field. Each field has one scale:
 * `identity` runs from `scale.domainMin` 0 to `scale.domainMax` 1 along the
 * `redgreyblue` scheme, as every display's identity does, and the others are
 * ordinal. The bases and the codons paint the theme's colors. The slots are
 * the shared color channel's, so `jbrowse validate` and "Edit plot..." judge
 * them as they judge any other display's.
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
 */
export const mafColorConfigSchema = ConfigurationSchema(
  'MafColor',
  {
    /**
     * #slot field
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('MafColorField', [...MAF_COLOR_FIELDS]),
      defaultValue: 'mismatch',
      description:
        'field to color each cell by: mismatch, base, identity, chromosome or codon',
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
            'the values the key lists, in order: under chromosome each rank from 0, the main source chromosome; under codon nonsyn, syn and stop',
        }),
        ...colorRangeSlot({
          range:
            "CSS colors: under chromosome one per rank from the main source chromosome, the last painting every rank past it; under identity the ramp's stops, winning over scheme; the bases and the codons paint the theme's colors",
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
          type: 'boolean',
          defaultValue: false,
          description:
            'turns the identity ramp round, so its last color paints the low end',
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
