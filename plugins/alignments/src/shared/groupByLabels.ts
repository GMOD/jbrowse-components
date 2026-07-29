// The group-by menu vocabulary, kept in a leaf module with no UI imports so it
// can be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's groupBy by its menu label. Importing
// GROUP_BY_DIMENSIONS instead would drag in the @jbrowse/alignments-core barrel
// and with it React, which the Node-side remark plugin cannot load. Same reason
// compactnessPresets.ts is its own module.
//
// GROUP_BY_DIMENSIONS reads its labels from here, so the menu and the docs
// cannot disagree. The Record is exhaustive over GroupByType, so adding a
// dimension without labelling it is a compile error.

import type { GroupByType } from './types.ts'

export const GROUP_BY_LABELS: Record<GroupByType, string> = {
  strand: 'Strand',
  firstOfPairStrand: 'First-of-pair strand',
  // never shown as-is: getGroupByMenuItem drops `tag` from the radios and adds a
  // separate 'Tag...' item that opens the tag dialog. This label names the
  // dimension (e.g. in the dialog's own copy), not that menu entry.
  tag: 'Tag (HP, RG, ...)',
  pairOrientation: 'Pair orientation',
  splitRead: 'Split read (SA tag)',
  mapq: 'Mapping quality',
  mateAssembly: 'Mate assembly',
}
