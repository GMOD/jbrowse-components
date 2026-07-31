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
// `autoDiagonalizeRequested` is raised before any render can paint, and only
// the init that raised it lowers it by completing the reorder. An init
// superseded in between must hand the gate to its replacement — left raised,
// `diagonalizeSettled` is false forever and a capture hangs instead of failing.
test('an init pass declares the diagonalize gate rather than only raising it', async () => {
  const session = setup()
  const view = session.addView('LinearSyntenyView', {
    init: { views },
  }) as LinearSyntenyViewModel
  // what an init that requested a reorder and was superseded leaves behind
  view.beginAutoDiagonalize(true)
  view.setWidth(800)

  await when(() => view.init === undefined, { timeout: 15000 })
  expect(view.autoDiagonalizeRequested).toBe(false)
  expect(view.diagonalizeSettled).toBe(true)
})
