import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { DotplotViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  return session
}

const views = [{ assembly: 'volvox' }, { assembly: 'volvox' }]

// `pendingAutoDiagonalize` is raised before any render can paint, so a capture
// can't commit the pre-reorder plot. The init that raised it is also the only
// thing that lowers it, by completing the reorder — so an init superseded in
// between must hand the gate to its replacement rather than leave it raised.
// Left raised, `settled` is false forever and a screenshot or browser test
// hangs instead of failing.
// Parks deterministically rather than racing the reorder: an assembly that is
// never configured neither initializes nor errors, so the reorder's wait for
// `initialized` cannot resolve on its own and the RPC can never run. The only
// thing that frees it is the supersede — which is also what this is testing.
const stalled = [{ assembly: 'volvox' }, { assembly: 'never-configured' }]

test('an init superseded before its reorder hands the gate to its replacement', async () => {
  const session = setup()
  const view = (await session.launchView('DotplotView', {
    init: { views: stalled, autoDiagonalize: true },
  })) as DotplotViewModel
  view.setWidth(800)

  // the gate goes up as the first step of the apply, before the reorder
  await when(() => view.pendingAutoDiagonalize)

  // superseded while parked in the reorder's wait, by an init wanting no reorder
  view.setInit({ views })

  await when(() => view.init === undefined)
  expect(view.pendingAutoDiagonalize).toBe(false)
})

// The same invariant from the other side, without racing an in-flight apply:
// whatever a prior pass left behind, the next one states the gate rather than
// inheriting it.
test('an init pass declares the gate rather than only raising it', async () => {
  const session = setup()
  const view = (await session.launchView('DotplotView', {
    init: { views },
  })) as DotplotViewModel
  // what a superseded reorder request leaves behind
  view.beginAutoDiagonalize(true)
  view.setWidth(800)

  await when(() => view.init === undefined)
  expect(view.pendingAutoDiagonalize).toBe(false)
})
