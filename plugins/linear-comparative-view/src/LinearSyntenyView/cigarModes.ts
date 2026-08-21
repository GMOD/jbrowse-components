/**
 * How a synteny match draws its CIGAR ops: 'full' colors indel wedges,
 * 'matches' leaves indels see-through (transparent), 'off' draws blocks only.
 * In menu order.
 *
 * Here rather than beside the menu that renders it because the website's figure
 * recipes name these labels in a click path, and the node script that builds
 * them cannot load a module importing React, MUI or a lazy `.tsx`. A leaf module
 * makes the recipe import the label instead of retyping it — which is also why
 * 'off' declares no warning icon here and the settings menu attaches it, and
 * why the label carries no ⚠ glyph: `pangenome/hprc_inversion` sets this mode,
 * so the label is printed as a doc click path.
 *
 * 'off' is the only mode that draws a gap the same as a match, but it is NOT
 * the only one that lays down a full-span block: pass 1 of buildSyntenyGeometry
 * skips that block for tiled features only, and 'matches' is the only mode that
 * tiles. So overlapping features stack in 'full' too — the difference is that
 * 'off' leaves them no internal structure to be told apart by.
 */
export const CIGAR_MODE_OPTIONS = [
  { value: 'full', label: 'Colored indels' },
  { value: 'matches', label: 'Transparent indels' },
  {
    value: 'off',
    label: "Off - don't draw CIGAR indels",
    helpText:
      'Watch out for weird rendering of overlapping features. Each alignment is drawn as one solid block from its start to its end, so overlapping blocks run together with nothing to tell them apart, and a large insertion or deletion inside a block is painted as though it matched all the way across.',
  },
] as const

export type CigarMode = (typeof CIGAR_MODE_OPTIONS)[number]['value']
