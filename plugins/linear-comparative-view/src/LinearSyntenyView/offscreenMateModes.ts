// A leaf module, like `cigarModes.ts`: the website's figure recipes name these
// labels in a click path from a node script that cannot load React or MUI.
export const OFFSCREEN_MATE_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  {
    value: 'query',
    label: 'Upper panel',
    helpText:
      'The upper panel of each pair is the one the file is queried from, so ' +
      'every alignment anchored in its window is already in hand, including ' +
      'the ones with no place to draw a ribbon to. Each of those gets a mark ' +
      'along the top edge, named with the contig its other end is on. ' +
      'Nothing extra is fetched.',
  },
  {
    value: 'both',
    label: 'Both panels (second query)',
    helpText:
      'Also queries the file from the lower panel of each pair, which is the ' +
      'only way to learn about alignments anchored down there whose other ' +
      'end the upper panel is not showing, and the only thing that puts a ' +
      'strip along the bottom edge. On a whole-genome file this is a second ' +
      'query per pair, so it is off by default.',
  },
] as const

export type OffscreenMateMode =
  (typeof OFFSCREEN_MATE_MODE_OPTIONS)[number]['value']

export const OFFSCREEN_MATE_MODE_VALUES = OFFSCREEN_MATE_MODE_OPTIONS.map(
  o => o.value,
)

export const OFFSCREEN_MATE_HELP =
  'A ribbon needs both of its ends on screen, so an alignment with only one ' +
  'end there draws nothing, and a locus syntenic to a chromosome you are not ' +
  'showing looks exactly like a locus syntenic to nothing. The upper panel ' +
  'can be marked for free, because the file is already queried from it; the ' +
  'lower panel needs a query of its own first.'
