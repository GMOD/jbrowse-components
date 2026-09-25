// The group-by menu vocabulary, kept in a leaf module with no UI imports so it
// can be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's facet by its menu label. Importing
// GROUP_BY_DIMENSIONS instead would drag in the @jbrowse/alignments-core barrel
// and with it React, which the Node-side remark plugin cannot load. Same reason
// compactnessPresets.ts is its own module.
//
// GROUP_BY_DIMENSIONS reads its labels from here, so the menu and the docs
// cannot disagree. The Record is exhaustive over the read dimensions, so adding
// one without labelling it is a compile error.

import type { ReadDimension } from './types.ts'

export const GROUP_BY_LABELS: Record<ReadDimension, string> = {
  strand: 'Strand',
  firstOfPairStrand: 'First-of-pair strand',
  pairOrientation: 'Pair orientation',
  splitRead: 'Split read (SA tag)',
  mapq: 'Mapping quality',
  mateAssembly: 'Mate assembly',
}

/**
 * The fragment strand the first mate implies, as a section chip and a colour
 * key both name it: a reverse-mapped read1 is on the forward fragment, so the
 * plain strand wording would read as the read's own strand.
 */
export const FIRST_OF_PAIR_STRAND_LABELS = {
  forward: 'First-of-pair forward',
  reverse: 'First-of-pair reverse',
} as const

/** The prefix a facet's `field` takes to name a read tag: `tags.HP`. */
export const TAG_FIELD_PREFIX = 'tags.'

/** The tag a facet field names, or undefined for any other field. */
export function facetTag(field: string | undefined) {
  return field?.startsWith(TAG_FIELD_PREFIX)
    ? field.slice(TAG_FIELD_PREFIX.length)
    : undefined
}
