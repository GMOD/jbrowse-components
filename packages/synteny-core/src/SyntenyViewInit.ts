import type { SyntenyColorBy } from './colorUtils.ts'

// Fields shared by LinearSyntenyView and DotplotView init blocks. Both view
// types support the same one-time-on-load toggles for chromosome painting,
// chain-noise filtering, and diagonalization. Extend this in each view's own
// Init interface and add the view-specific fields (e.g. levelHeights for
// LinearSyntenyView).
export interface SyntenyViewSharedInit {
  // After tracks load, automatically run the chromosome diagonalization
  // pass so the bottom/vertical axis follows the top/horizontal axis. The
  // canvas is hidden behind a "Reordering chromosomes…" spinner during the
  // wait, so the user doesn't see an undiagonalized flash.
  autoDiagonalize?: boolean
  // Initial colorBy. Use 'query' (chromosome painting) for whole-genome
  // views where the default red is hard to distinguish across many ribbons.
  colorBy?: SyntenyColorBy
  // Per-feature alignment-length filter applied at the renderer. Hides
  // chains shorter than this many bp; cuts the genome-scale hairball.
  minAlignmentLength?: number
}
