import { reactionDependencies } from '@jbrowse/render-core/namedReactions'

import { createMafTestEnvironment } from './testEnv.ts'

// The display installs its reactions from one `afterAttach`, and the one that
// keeps the placed rows observed is a *named* autorun so its dependency set is
// readable. `rpcDataMap` is a memo over the store and the row order, so what
// the observer tracks is what a reorder re-places on — and a memo nobody
// observes re-places every region on every read.
test('the placed-rows observer tracks the store and the row order', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  const placedRows = () => reactionDependencies(display, 'Maf:placedRows')
  expect(placedRows()).toEqual(
    expect.arrayContaining([
      'RowArrangementConfigurationSchema.domain',
      'LinearMafDisplay.sourcesVolatile',
      'RowArrangementConfigurationSchema.kept',
      'LinearMafDisplayConfigurationSchema.showReferenceRow',
      'LinearMafDisplay.loadedRegions',
    ]),
  )
  // Which row is the reference moves rows only while it is hidden, so the
  // placement sees it then and only then.
  expect(placedRows()).not.toContain('LinearMafDisplay.refSampleIdVolatile')
  display.setShowReferenceRow(false)
  expect(placedRows()).toContain('LinearMafDisplay.refSampleIdVolatile')
})
