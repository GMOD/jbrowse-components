import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { LinearSyntenyViewCommands } from './types.ts'

// `views` is the one real discriminator here: a row carrying `type` is a built
// LinearGenomeView snapshot MST restores, one without it is a recipe this
// view's own launcher opens. Model-guaranteed, since an LGV's `type` is a
// required literal; two empty rows are the deliberate request for the import
// form and route as recipes.
//
// `tracks` is an unconditional lift. The view declares no top-level `tracks` —
// the levels between the rows hold theirs — so a spec's per-level trackId list
// collides with nothing. `LinearComparativeView`'s pre-`levels` conversion of a
// legacy top-level `tracks` runs after this, and so no longer sees one.
//
// `sameScale` is `replay`, the one kind that is not remapped: the value lands
// on the declared property, and a copy rides in the blob because launching also
// has to zoom the rows onto the shared scale, after `autoDiagonalize` has
// rewritten and re-centred them. `colorBy`, `showColorLegend`, `alpha`,
// `minAlignmentLength` and the rest are plain properties — writing them is the
// whole job, so none of them is a launch key.
export const linearSyntenyLaunchKeys =
  defineLaunchKeys<LinearSyntenyViewCommands>()({
    views: { kind: 'rows' },
    tracks: { kind: 'launch' },
    levelHeights: { kind: 'launch' },
    autoDiagonalize: { kind: 'launch' },
    collapseEmptyRows: { kind: 'launch' },
    drawCurves: { kind: 'launch' },
    drawLocationMarkers: { kind: 'launch' },
    sameScale: { kind: 'replay' },
  })
