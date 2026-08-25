/**
 * HOW HARD TO LOOK for the alignments this view has nowhere to draw, as three
 * steps of one question rather than two checkboxes of two. A reader is not
 * choosing between "mark them" and "search both rows"; they are deciding how
 * much of what this view cannot draw they want to know about, and the last
 * step costs a query where the first is free.
 *
 * THE STEPS ARE THE TWO PANELS, and a panel can be reported on only if it was
 * QUERIED. A synteny file is queried from the upper panel of each pair, so the
 * middle step reports that panel completely and for nothing: every alignment
 * anchored in its window came back, whether its other end has no place on the
 * facing axis at all or a place that has scrolled off it. Nothing asks about
 * the lower panel until the last step does.
 *
 * WHY THE LOWER PANEL IS NOT FREE, given that a single fetch already holds some
 * of its marks: an alignment marked along the bottom edge is one whose query
 * end the upper panel does not have on screen, so the only ones in hand are
 * those inside the pan buffer the fetch window is padded by. That is a CACHE
 * boundary rather than a fact about the data — the strip would stop where the
 * fetch window ends instead of where the alignments do, jump as the upper panel
 * pans across the snap grid, and print a count that is an arbitrary fraction of
 * what goes to that contig with nothing saying so. `laneData` is where the lane
 * waits for the query that completes it, and the labels below are that rule
 * said out loud.
 *
 * ONE CONTROL, TWO PROPERTIES, which is what the row-sync control does with
 * `linkViews`/`followSynteny` and for the same reason. They stay separate
 * properties because they are separate KINDS: `showOffscreenMates` is a
 * repaint — the worker counted and placed those marks whichever way it sits —
 * and `bidirectionalFetch` is a fetch input. Fusing them into one boolean would
 * put the free half behind a network round trip, and would have to pick one
 * default for two things that were each decided on their own numbers: marks
 * lead, because a feature nobody finds reports nothing, and the second query
 * does not, because on an indexed whole-genome file it is real I/O. It also
 * closes the state the pair could reach and nothing wanted: fetching the second
 * row and then not drawing what it found.
 *
 * A leaf module, for the reason `cigarModes.ts` is one: the website's figure
 * recipes name these labels in a click path, and the node script that builds
 * them cannot load a module importing React, MUI or a lazy `.tsx`.
 */
export const OFFSCREEN_MATE_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  {
    value: 'query',
    label: 'Mark them on the upper panel',
    helpText:
      'The upper panel of each pair is the one the file is queried from, so ' +
      'it is the panel this view knows every missing alignment of: whatever ' +
      'is anchored in its window came back, including the ones there is no ' +
      'way to draw. Each of those gets a mark along the top edge, named with ' +
      'the contig its other end is on — either a contig the lower panel is ' +
      'not displaying, or one it is displaying and has scrolled away from. ' +
      'Nothing extra is fetched.',
  },
  {
    value: 'both',
    label: 'Query the lower panel too, and mark it as well',
    helpText:
      'A second query per panel pair, run from the lower panel, and the only ' +
      'thing that puts a strip along the bottom edge. An alignment anchored ' +
      'down there whose other end is somewhere the upper panel is not showing ' +
      'is never asked for otherwise — which is why the same two genomes ' +
      'report differently depending on which one you stack on top. It is also ' +
      'what makes a bottom mark worth trusting: without it the view holds ' +
      'only the alignments within a screen or so of the upper panel, so the ' +
      'strip would stop at the edge of what was fetched rather than at the ' +
      'edge of what exists, and each mark would report a fraction of its ' +
      'count. On a whole-genome file this is real work, so it is off by ' +
      'default.',
  },
] as const

export type OffscreenMateMode =
  (typeof OFFSCREEN_MATE_MODE_OPTIONS)[number]['value']

export const OFFSCREEN_MATE_HELP =
  'A ribbon needs both of its ends on screen, so an alignment with only one ' +
  'end there draws nothing at all — and a locus syntenic to a chromosome you ' +
  'are not showing then looks exactly like a locus syntenic to nothing. These ' +
  'steps decide how much of that the view tells you about, and they differ by ' +
  'WHICH PANEL is reported on. The upper one is free, because the file is ' +
  'already queried from it; the lower one needs a query of its own before ' +
  'anything about it can be counted.'
