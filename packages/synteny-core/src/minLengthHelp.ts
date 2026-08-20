// What the "Min length" row says in both comparative views, so the two cannot
// describe the same control differently.
//
// A leaf module, for the reason `cigarModes.ts` is one: it is read by menu
// builders that must stay clear of React, and by the website's recipe tables,
// whose node script cannot load a module importing MUI or a lazy `.tsx`.
//
// The second sentence is the one that earns its place. `buildSyntenyGeometry`
// filters each drawn block by its OWN span and deliberately cannot group blocks
// that share a name — a BAM read's QNAME is shared across its supplementary
// alignments, and summing those would keep a read whose pieces are each tiny
// while hiding a substantial single block. The visible consequence is on the
// coarse LOD tier, where make-pif has split a long alignment on its large
// indels: the pieces are filtered as the separate blocks they are, so crossing
// the tier threshold with this set can hide an alignment the fine tier shows.
export const MIN_LENGTH_HELP =
  'Hides alignments shorter than this many bp. Cuts whole-genome hairball ' +
  'noise from short/spurious chains. Each drawn block is measured by its own ' +
  'span, never grouped with others of the same name — so a level-of-detail ' +
  'tier that splits a long alignment on its large indels is filtered piece by ' +
  'piece.'

// Where the log-scaled Min length slider tops out, in bp. Shared so the synteny
// view and the dotplot cannot offer different ranges over the same setting.
export const MAX_MIN_LENGTH_BP = 1_000_000
