import type { SyntenyColorSnapshot } from './syntenyColorConfigSchema.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// The one launch key LinearSyntenyView and DotplotView share: a thing to DO on
// load, with no property behind it. Each view's own Commands interface extends
// this, and `defineLaunchKeys` takes `Record<keyof Commands, LaunchKeySpec>`,
// so everything in here has to be a launch key.
export interface SyntenyViewSharedCommands {
  // After tracks load, automatically run the chromosome diagonalization
  // pass so the bottom/vertical axis follows the top/horizontal axis. The
  // canvas is hidden behind a "Reordering chromosomes…" spinner during the
  // wait, so the user doesn't see an undiagonalized flash.
  autoDiagonalize?: boolean
}

// The view-level knobs both comparative views accept, for a caller that wants
// to name the shared set once — jbrowse-img's CLI flags, the two launchers.
// Everything below the commands is a declared property of both models, so MST
// lands it natively off the view object and no launcher interprets it.
export interface SyntenyViewSharedInit extends SyntenyViewSharedCommands {
  // The channels every track paints with (`SyntenyEncoding`): a color field
  // such as `{ color: 'query' }` (chromosome painting) for whole-genome views
  // where the default red is hard to distinguish across many ribbons.
  encoding?: { color?: SyntenyColorSnapshot | string }
  // The alignments drawn, a list of field predicates:
  // `[{ field: 'length', gte: 100000 }]` hides chains shorter than 100 kb,
  // which cuts the genome-scale hairball.
  filter?: FieldPredicate[]
}
