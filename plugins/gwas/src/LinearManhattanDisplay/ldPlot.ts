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

/** A point's colour under LD: its r² to the index SNP, in LocusZoom's bins. */
export const LD_COLOR = {
  field: LD_FIELD,
  scale: 'threshold',
  domain: LD_DOMAIN,
  range: LD_PALETTE,
  title: 'r² to index SNP',
}

/** A point's shape under LD: the index SNP is the diamond. */
export const LD_SHAPE = {
  field: LD_ROLE_FIELD,
  domain: ['index', 'partner'],
  range: ['diamond', 'circle'],
  title: 'LD role',
}

/** A Manhattan plot's one mark: a point per feature at its `score`. */
export const MANHATTAN_MARK = { mark: 'point', encoding: { y: 'score' } }

/** The same points coloured by r² to the index SNP, the index a diamond. */
export const LD_MARK = {
  mark: 'point',
  encoding: { y: 'score', color: LD_COLOR, shape: LD_SHAPE },
}

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
