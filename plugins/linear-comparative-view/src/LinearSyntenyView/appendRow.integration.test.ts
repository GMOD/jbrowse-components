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

// `rowCount` assemblies chained by a synteny track between each adjacent pair,
// so the view opens with rowCount-1 levels the way a multi-way launch would.
async function openStack(rowCount: number) {
  const session = createTestSession()
  const names = Array.from({ length: rowCount }, (_, i) => `volvox${i}`)
  for (const name of names) {
    session.addAssemblyConf(assembly(name))
  }
  for (let i = 0; i < rowCount - 1; i++) {
    session.addTrackConf({
      type: 'SyntenyTrack',
      trackId: `synteny${i}`,
      name: `synteny${i}`,
      assemblyNames: [names[i], names[i + 1]],
      adapter: {
        type: 'PAFAdapter',
        pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
        queryAssembly: names[i],
        targetAssembly: names[i + 1],
      },
    })
  }
  const view = session.addView('LinearSyntenyView', {
    init: { views: names.map(assembly => ({ assembly })) },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  await when(() => view.levels.length === rowCount - 1)
  return { session, view }
}

const heights = (view: LinearSyntenyViewModel) => view.levels.map(l => l.height)

// The band budget splits 320px across the levels, so a launched 6-row stack
// opens at 64px a band. Appending a row is the third way a level comes into
// existence and has to land on the same number the other two do.
test('an appended level matches the auto-scaled stack it joins', async () => {
  const { view } = await openStack(6)
  expect(heights(view)).toEqual([64, 64, 64, 64, 64])

  view.appendRow({ assembly: 'volvox0' })
  expect(heights(view)).toEqual([64, 64, 64, 64, 64, 64])
})

// A band the user dragged is the height they chose for this stack; the row they
// add below it must not come in at the factory default either.
test('an appended level matches a hand-resized stack', async () => {
  const { view } = await openStack(2)
  view.levels[0]!.setHeight(210)

  view.appendRow({ assembly: 'volvox0' })
  expect(heights(view)).toEqual([210, 210])
})
