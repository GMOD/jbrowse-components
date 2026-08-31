import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  return session
}

const views = [{ assembly: 'volvox' }, { assembly: 'volvox2' }]

// The synteny half of the same invariant the dotplot test covers:
// `pendingAutoDiagonalize` is raised before any render can paint, and only the
// init that raised it lowers it by completing the reorder. An init superseded
// in between must hand the gate to its replacement — left raised, `settled` is
// false forever and a capture hangs instead of failing.
test('an init pass declares the diagonalize gate rather than only raising it', async () => {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    views,
  }) as LinearSyntenyViewModel
  // what an init that requested a reorder and was superseded leaves behind
  view.beginAutoDiagonalize(true)
  view.setWidth(800)

  await when(() => view.pendingLaunch === undefined)
  expect(view.pendingAutoDiagonalize).toBe(false)
})

// The levels exist from the moment the rows do, but `init` adds the synteny
// tracks several awaits later — and an empty level clears its canvas, reports
// it drawn, and settles vacuously over its (zero) displays. Left ungated, the
// synteny_canvas_done testid appears on a blank band and a capture takes it.
test('a level does not settle while init is still adding its tracks', async () => {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    views,
  }) as LinearSyntenyViewModel
  view.setWidth(800)

  await when(() => view.levels.length > 0)
  const level = view.levels[0]!
  // the shape that settles vacuously: painted, with nothing left to be
  // unsettled by
  level.markCanvasDrawn()
  expect(level.linearSyntenyDisplays).toHaveLength(0)
  expect(level.settled).toBe(false)

  await when(() => view.pendingLaunch === undefined)
  expect(level.settled).toBe(true)
})

// A row is an LGV, so an authored row can set the LGV's own view props. They
// used to be hand-forwarded one at a time (trackLabels only), which silently
// dropped the rest: a spec asking a panel not to draw amino acids got them
// anyway, with no warning to say why.
test('a row spec sets the LGV view props on its own panel', async () => {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    views: [
      { assembly: 'volvox', showAminoAcids: false, trackLabels: 'offset' },
      { assembly: 'volvox2' },
    ],
  }) as LinearSyntenyViewModel
  view.setWidth(800)

  await when(() => view.pendingLaunch === undefined)
  expect(view.views[0]!.showAminoAcids).toBe(false)
  expect(view.views[0]!.trackLabels).toBe('offset')
  // the row that asked for nothing keeps the defaults
  expect(view.views[1]!.showAminoAcids).toBe(true)
})
