/**
 * HOW HARD TO LOOK for the alignments this view has nowhere to draw, as three
 * steps of one question rather than two checkboxes of two. A reader is not
 * choosing between "mark them" and "search both rows"; they are deciding how
 * much of what this view cannot draw they want to know about, and the second
 * step costs a query where the first is free.
 *
 * THE STEPS DIFFER BY WHAT IS FETCHED, NOT BY WHICH PANEL IS MARKED, and the
 * labels used to say the opposite. "Mark them, both rows" was true only while
 * the lower panel's strip had ONE source of marks — the alignments anchored
 * down there, which only the second query can see. It has two now: the other is
 * every alignment already loaded whose query end the upper panel has scrolled
 * off (`culledRibbonMates`), which costs nothing and is often the larger. On the
 * grape/peach figure zoomed to 4Mb the lower strip is already the bigger of the
 * two at the middle step, so a label promising the lower panel at the LAST step
 * was naming something the reader already had — and a reader who then saw marks
 * appear down there without picking it had no way to account for them.
 *
 * So the middle step says which panels it marks, the last says what it queries,
 * and the two `helpText`s carry the why: a mark goes on whichever panel still
 * has the alignment on screen, and the file is only ever queried from the upper
 * one unless you ask.
 *
 * ONE CONTROL, TWO PROPERTIES, which is what the row-sync control does with
 * `linkViews`/`followSynteny` and for the same reason. They stay separate
 * properties because they are separate KINDS: `showOffscreenMates` is a
 * repaint — the worker counted and placed those marks whichever way it sits —
 * and `bidirectionalFetch` is a fetch input. Fusing them into one boolean would
 * put the free half behind a network round trip, which is the mistake
 * `drawLocationMarkers` was in the fetch key for. It also closes the state the
 * pair could reach and nothing wanted: fetching the second row and then not
 * drawing what it found.
 *
 * A leaf module, for the reason `cigarModes.ts` is one: the website's figure
 * recipes name these labels in a click path, and the node script that builds
 * them cannot load a module importing React, MUI or a lazy `.tsx`.
 */
export const OFFSCREEN_MATE_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  {
    value: 'query',
    label: 'Mark them on both panels',
    helpText:
      'Every alignment already loaded that this view cannot draw gets a mark, ' +
      'on whichever panel still has it on screen — so both panels carry a ' +
      'strip. A mark along the top means the LOWER panel is the one that ' +
      'cannot pair its other end, either because that end is on a contig the ' +
      'lower panel is not displaying or because it has scrolled away from it; ' +
      'a mark along the bottom is the same sentence with the panels swapped. ' +
      'Nothing extra is fetched for either strip.',
  },
  {
    value: 'both',
    label: 'Mark them, and query the lower panel for more',
    helpText:
      'A synteny file is queried from the UPPER panel of each pair, so an ' +
      'alignment anchored on the lower panel whose other end is somewhere the ' +
      'upper panel is not showing is never asked for at all — which is why ' +
      'the same two genomes report differently depending on which one you ' +
      'stack on top. This adds a second query per panel pair to go and find ' +
      'them. It is not what puts marks on the lower panel: that strip is drawn ' +
      'either way. What it adds is the alignments nothing else requests. On a ' +
      'whole-genome file it is real work, so it is off by default.',
  },
] as const

export type OffscreenMateMode =
  (typeof OFFSCREEN_MATE_MODE_OPTIONS)[number]['value']

export const OFFSCREEN_MATE_HELP =
  'A ribbon needs both of its ends on screen, so an alignment with only one ' +
  'end there draws nothing at all — and a locus syntenic to a chromosome you ' +
  'are not showing then looks exactly like a locus syntenic to nothing. These ' +
  'steps decide how much of that the view tells you about. Marking is free ' +
  'and covers both panels; only the last step costs a query.'
