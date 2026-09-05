import { reactionDependencies } from '@jbrowse/render-core/namedReactions'

import { createMafTestEnvironment } from './testEnv.ts'

// The display installs its reactions from one `afterAttach`, and the one that
// keeps the placed rows observed is a *named* autorun so its dependency set is
// readable. `rpcDataMap` is a memo over the store and the row order, so what
// the observer tracks is what a reorder re-places on — and a memo nobody
// observes re-places every region on every read.
test('the placed-rows observer tracks the store and the row order', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  expect(reactionDependencies(display, 'Maf:placedRows')).toEqual(
    expect.arrayContaining([
      'LinearMafDisplay.layout',
      'LinearMafDisplay.sourcesVolatile',
      'LinearMafDisplay.subtreeFilter',
      // Both halves of "hide the reference row": which row it is, and whether
      // it is hidden. Rows move when either changes, so the placement has to
      // see both.
      'LinearMafDisplay.refSampleIdVolatile',
      'LinearMafDisplayConfigurationSchema.showReferenceRow',
      'LinearMafDisplay.loadedRegions',
    ]),
  )
})
