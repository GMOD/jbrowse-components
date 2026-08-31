import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

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

// A row of a synteny stack is a real LGV holding real displays, but nothing
// renders it through `ViewContainer` — the stack's own container is the only
// one there is. So the row's raw `bodyMounted` stays at its default forever,
// and a display in it reads the stack's answer only through the nested walk.
test('a row of an unmounted stack reports its body unmounted', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  const view = session.addView('LinearSyntenyView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.views.length === 2)
  const row = view.views[0]!

  expect(row.effectiveBodyMounted).toBe(true)

  view.setBodyMounted(false)
  expect(row.bodyMounted).toBe(true)
  expect(row.effectiveBodyMounted).toBe(false)
  expect(view.levels[0]?.surfaceReadiness.hostMounted).toBe(false)

  view.setBodyMounted(true)
  expect(row.effectiveBodyMounted).toBe(true)
})
