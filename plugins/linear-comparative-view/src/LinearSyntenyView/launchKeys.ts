import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'
import { LIFTED_VIEW_KEYS } from '@jbrowse/synteny-core'

import type { LinearSyntenyViewCommands } from './types.ts'

// `views` is the one real discriminator here: a row carrying `type` is a built
// LinearGenomeView snapshot MST restores, one without it is a recipe this
// view's own launcher opens. Model-guaranteed, since an LGV's `type` is a
// required literal; two empty rows are the deliberate request for the import
// form and route as recipes.
//
// `tracks` is an unconditional lift. The view declares no top-level `tracks` —
// the levels between the rows hold theirs — so a spec's per-level trackId list
// collides with nothing.
//
// `sameScale` is `replay`, the one kind that is not remapped: the value lands
// on the declared property, and a copy rides in the blob because launching also
// has to zoom the rows onto the shared scale, after `autoDiagonalize` has
// rewritten and re-centred them. `color`, `alpha`,
// `minAlignmentLength` and the rest are plain properties — writing them is the
// whole job, so none of them is a launch key.
//
// `colorBy` is v4's spelling of `color`, which the model's own
// preProcessSnapshot converts (`liftSyntenyViewSettings`), so the partition
// passes it through rather than reading it as a typo.
export const linearSyntenyLaunchKeys =
  defineLaunchKeys<LinearSyntenyViewCommands>()(
    {
      views: { kind: 'rows' },
      tracks: { kind: 'launch' },
      levelHeights: { kind: 'launch' },
      autoDiagonalize: { kind: 'launch' },
      collapseEmptyRows: { kind: 'launch' },
      sameScale: { kind: 'replay' },
    },
    { passThrough: LIFTED_VIEW_KEYS },
  )
