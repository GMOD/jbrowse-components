/**
 * HOW HARD TO LOOK for the alignments this view has nowhere to draw, as three
 * steps of one question rather than two checkboxes of two. A reader is not
 * choosing between "mark them" and "search both rows"; they are deciding how
 * much of what this view cannot draw they want to know about, and the second
 * step costs a query where the first is free.
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
  { value: 'query', label: 'Mark them' },
  { value: 'both', label: 'Mark them, both rows' },
] as const

export type OffscreenMateMode =
  (typeof OFFSCREEN_MATE_MODE_OPTIONS)[number]['value']

export const OFFSCREEN_MATE_HELP =
  'An alignment the facing row cannot pair has only one end on screen, so no ' +
  'ribbon is drawn for it — either its mate is on a contig that row is not ' +
  'displaying, or on one it has scrolled away from. Mark them puts those on ' +
  'a strip along the axis they do have, from the alignments this view ' +
  'already holds. Marking both rows adds a second query per row pair, and is ' +
  'the only way to find the ones anchored on the lower row.'
