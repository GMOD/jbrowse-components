import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { normalizeChannel } from '@jbrowse/display-kit/colorConfigSchema'
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
    scale: 'categorical',
    domain: [...BASE_KEYS, 'match'],
    title: 'Mismatch to reference',
  },
  base: {
    scale: 'categorical',
    domain: BASE_KEYS,
    title: 'Base',
  },
  identity: {
    ...MEASURE_FIELD_PRESETS.identity,
    title: 'Per-base identity to reference',
  },
  chromosome: {
    scale: 'categorical',
    domain: SOURCE_CHROM_PALETTE.map((_, rank) => String(rank)),
    range: SOURCE_CHROM_PALETTE,
    labels: SOURCE_CHROM_RANK_LABELS,
    title: 'Source chromosome',
  },
  codon: {
    scale: 'categorical',
    domain: ['nonsyn', 'syn', 'stop'],
    labels: ['Nonsynonymous', 'Synonymous', 'Stop gained'],
    title: 'Codon change',
  },
} as const satisfies FieldPresets<'categorical' | 'linear'> &
  Record<MafColorField, unknown>

/**
 * #config MafColor
 * #category display
 * The MAF display's `color`: what colors each species row's aligned cells.
 * `mismatch` paints a base only where it differs from the reference,
 * `base` every base, `identity` the mean identity to the reference along a
 * ramp, `chromosome` each block by the rank of its source chromosome within
 * the row, and `codon` each codon by its amino-acid change, given an
 * `annotationAdapter`. A string is the field. Each field has one scale:
 * `identity` runs from `domainMin` 0 to `domainMax` 1 along the `viridis`
 * scheme, as every display's identity does, and the others are categorical. The bases and the
 * codons paint the theme's colors. The slots are the shared color object's,
 * so `jbrowse validate` and "Edit plot..." judge them as they judge any other
 * display's.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', color: 'identity' }
 * ```
 * ```js
 * { type: 'LinearMafDisplay', color: 'identity', y: 'identity' }
 * ```
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   color: { field: 'identity', domainMin: 0.7, scheme: 'magma' },
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
        'what colors a cell: mismatch, base, identity, chromosome or codon',
    },
    /**
     * #slot domain
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the values the key lists, in order: under chromosome each rank from 0, the main source chromosome; under codon nonsyn, syn and stop',
    },
    /**
     * #slot range
     */
    range: {
      type: 'colorArray',
      defaultValue: [],
      description:
        "CSS colors: under chromosome one per rank from the main source chromosome, the last painting every rank past it; under identity the ramp's stops, winning over scheme; the bases and the codons paint the theme's colors",
    },
    /**
     * #slot labels
     */
    labels: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'what the key names each domain value, one each in order; one past the list keeps its own name',
    },
    /**
     * #slot title
     */
    title: {
      type: 'maybeString',
      description:
        'key title; unset is the field\'s own heading, "" draws none',
    },
    /**
     * #slot scheme
     */
    scheme: {
      type: 'maybeStringEnum',
      model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
      description:
        "the named ramp identity runs along; unset is viridis, and range's colors, where it lists any, win over it",
    },
    /**
     * #slot reverse
     */
    reverse: {
      type: 'boolean',
      defaultValue: false,
      description:
        'turns the identity ramp round, so its last color paints the low end',
    },
    /**
     * #slot domainMin
     */
    domainMin: {
      type: 'maybeNumber',
      description:
        "the identity the ramp's low end paints, 0 to 1; unset is 0, and 0.7 spreads the ramp over close relatives",
    },
    /**
     * #slot domainMax
     */
    domainMax: {
      type: 'maybeNumber',
      description: "the identity the ramp's high end paints; unset is 1",
    },
    /**
     * #slot domainMid
     */
    domainMid: {
      type: 'maybeNumber',
      description:
        "the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it",
    },
  },
  {
    shorthand: 'field',
    closed: true,
    fieldPresets: MAF_FIELD_PRESETS,
    preProcessSnapshot: (snap: Record<string, unknown> | undefined) =>
      normalizeChannel(snap, 'color'),
  },
)
