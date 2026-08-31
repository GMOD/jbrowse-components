import type { TrackInit } from '@jbrowse/core/util/tracks'

/**
 * The launch keys `CircularView` writes code for: an assembly to draw the
 * circle from, the refNames to restrict it to, and the chord tracks to open.
 * `circularLaunchKeys` registers exactly these, and the Record it takes makes
 * an unregistered one a compile error.
 *
 * A plain display setting does not belong here — `bpPerPx`, `paddingPx`,
 * `autoFit` and the rest are declared on the model, and the partition leaves
 * them on the snapshot for MST to restore.
 *
 * #launchKeys CircularView — the URL parameters page renders this interface as
 * the view's launch-key table. The `//` comment above each field is what that
 * table shows, so a field added without one fails the docs build rather than
 * rendering a blank cell.
 */
export interface CircularViewCommands {
  // the assembly whose chromosomes the circle draws. Optional because a spec
  // view is untyped user input; without one the view opens on its import form
  assembly?: string
  // whole chromosomes to draw, in this order; the rest of the assembly's
  // contigs are left off the circle
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
}
