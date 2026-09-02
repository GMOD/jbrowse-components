// The group-by menu vocabulary, kept in a leaf module with no UI imports so it
// can be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's groupBy by its menu label. Importing
// GROUP_BY_DIMENSIONS instead would drag in the @jbrowse/alignments-core barrel
// and with it React, which the Node-side remark plugin cannot load. Same reason
// compactnessPresets.ts is its own module.
//
// GROUP_BY_DIMENSIONS reads its labels from here, so the menu and the docs
// cannot disagree. The Record is exhaustive over the selectable dimensions, so
// adding one without labelling it is a compile error.

import type { ParameterlessGroupByType } from './types.ts'

// `tag` has no entry, and the type says so: the menus drop it from the radios in
// favour of a 'Tag...' item that opens a dialog for the tag name, and the
// website recipe names it by that path — so a label here would never be shown.
export const GROUP_BY_LABELS: Record<ParameterlessGroupByType, string> = {
  strand: 'Strand',
  firstOfPairStrand: 'First-of-pair strand',
  pairOrientation: 'Pair orientation',
  splitRead: 'Split read (SA tag)',
  mapq: 'Mapping quality',
  mateAssembly: 'Mate assembly',
}
