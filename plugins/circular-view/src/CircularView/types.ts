import type { TrackInit } from '@jbrowse/core/util/tracks'

/**
 * The launch keys `CircularView` resolves before they become view state; a
 * plain setting is declared on the model instead.
 *
 * #launchKeys CircularView — each field's `//` comment is its row in the URL
 * parameters page's table.
 */
export interface CircularViewCommands {
  // the assembly whose chromosomes the circle draws, or the assemblies, in the
  // order their slices are laid out — a synteny ribbon plot wants both ends of
  // its alignments on the circle. Optional because a spec view is untyped user
  // input; without one the view opens on its import form
  assembly?: string | string[]
  // whole chromosomes to draw, in this order; the rest of the assembly's
  // contigs are left off the circle. A list applies to every assembly on the
  // circle, and `{ hg38: ['chr1'], mm39: ['chr2'] }` restricts each one
  // separately, leaving an assembly it does not name whole
  displayedRegionNames?: string[] | Record<string, string[]>
  tracks?: TrackInit[]
  // On a circle of two genomes with a synteny track, reorder the second
  // genome's chromosomes to follow the first's and lay them out mirrored, so the
  // ribbons form a band of parallel arcs instead of crossing at the center.
  // The figure is hidden behind a "Reordering chromosomes" screen during the
  // wait. Same key and same pass as the linear synteny view's and the dotplot's
  autoDiagonalize?: boolean
}
