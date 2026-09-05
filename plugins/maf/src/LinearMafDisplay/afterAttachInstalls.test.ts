import { reactionDependencies } from '@jbrowse/render-core/namedReactions'

import { createMafTestEnvironment } from './testEnv.ts'

// The display installs its reactions from one `afterAttach`, and the row
// placement one is a *named* autorun so its dependency set is readable. That
// matters here because an MST action's own reads are untracked: the row order
// has to be read in the autorun body, and a body that read it inside
// `placeFetchedRows` instead would install cleanly and then never re-place.
test('the row-placement autorun tracks the row order', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  expect(reactionDependencies(display, 'Maf:placeFetchedRows')).toEqual(
    expect.arrayContaining([
      'LinearMafDisplay.layout',
      'LinearMafDisplay.sourcesVolatile',
      'LinearMafDisplay.subtreeFilter',
      // Both halves of "hide the reference row": which row it is, and whether
      // it is hidden. Rows move when either changes, so the placement has to
      // see both.
      'LinearMafDisplay.refSampleIdVolatile',
      'LinearMafDisplayConfigurationSchema.showReferenceRow',
    ]),
  )
})
