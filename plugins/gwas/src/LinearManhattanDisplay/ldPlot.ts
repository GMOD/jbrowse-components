import { LD_FIELD, LD_ROLE_FIELD } from '../GWASAdapter/ldFields.ts'

import type { MarkConfig } from '@jbrowse/plugin-marks'

/** LocusZoom.js's r² cuts and the palette of the five bins between them. */
export const LD_DOMAIN = ['0.2', '0.4', '0.6', '0.8']
export const LD_PALETTE = [
  '#357ebd',
  '#46b8da',
  '#5cb85c',
  '#eea236',
  '#d43f3a',
]

/**
 * A partner's colour: its r² to the index SNP in LocusZoom's bins, the key
 * listing them highest first as LocusZoom does.
 */
export const LD_COLOR = {
  field: LD_FIELD,
  scale: 'threshold',
  domain: LD_DOMAIN,
  range: LD_PALETTE,
  title: 'r² to index SNP',
  descending: true,
  missingLabel: 'No LD data',
}

/** A Manhattan plot's one mark: a point per feature at its `score`. */
export const MANHATTAN_MARK = { mark: 'point', encoding: { y: 'score' } }

/** The index SNP's colour, apart from every r² bin. */
export const LD_INDEX_COLOR = '#c951c9'

/**
 * Every point but the index SNP, coloured by its r² to it. A SNP the join
 * left out has no `ld_role`, so the filter keeps it, grey as "No LD data".
 */
export const LD_PARTNERS_MARK = {
  mark: 'point',
  transform: [
    {
      type: 'filter',
      expr: `jexl:feature.${LD_ROLE_FIELD} != 'index'`,
    },
  ],
  encoding: { y: 'score', color: LD_COLOR },
}

/**
 * The index SNP alone, drawn over the rest as a diamond in its own colour,
 * with its own key row.
 */
export const LD_INDEX_MARK = {
  mark: 'point',
  transform: [
    {
      type: 'filter',
      expr: `jexl:feature.${LD_ROLE_FIELD} == 'index'`,
    },
  ],
  encoding: {
    y: 'score',
    color: { value: LD_INDEX_COLOR },
    shape: {
      field: LD_ROLE_FIELD,
      domain: ['index'],
      range: ['diamond'],
      labels: ['Index SNP'],
      title: '',
    },
  },
}

/** LocusZoom's plot, which "Color by LD to index SNP" writes. */
export const LD_MARKS = [LD_PARTNERS_MARK, LD_INDEX_MARK]

const LD_FIELDS = new Set<string>([LD_FIELD, LD_ROLE_FIELD])

/**
 * Whether a mark's encoding names a field the LD join writes, which is what
 * makes a fetch join the `ldAdapter`: a `y`, a `text`, or the field a colour,
 * shape or size scale reads.
 */
export function readsLd({ encoding }: MarkConfig) {
  return [
    encoding.y,
    encoding.text,
    encoding.color.field,
    encoding.shape.field,
    encoding.size.field,
  ].some(field => LD_FIELDS.has(field))
}
