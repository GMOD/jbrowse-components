import { readConfObject } from '@jbrowse/core/configuration'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'vol_synteny',
    name: 'vol synteny',
    assemblyNames: ['volvox', 'volvox2'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox',
      targetAssembly: 'volvox2',
    },
  })
  return session
}

const views = [{ assembly: 'volvox' }, { assembly: 'volvox2' }]

async function openWith(init: Record<string, unknown>) {
  const session = setup()
  const view = (await session.launchView('LinearSyntenyView', {
    init,
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  // levels are reconciled from the view pairs; give the init pass its microtasks
  await when(() => view.levels.length > 0)
  return view
}

// a level's `tracks` is a pluggableMstType array, so its element type is loose;
// naming the one member this reads keeps it checked without a cast
const openTrackIds = (view: LinearSyntenyViewModel) =>
  view.levels.flatMap(l =>
    (l.tracks as { configuration: AnyConfigurationModel }[]).map(
      t => readConfObject(t.configuration, 'trackId') as string,
    ),
  )

// The `init.tracks` shorthand documented on the LinearSyntenyView state model:
// a flat string[] means "all on level 0". This is the form a hand-authored
// defaultSession uses, and the form the model's own #example shows.
test('a flat init.tracks opens the synteny track on level 0', async () => {
  const view = await openWith({ views, tracks: ['vol_synteny'] })
  await when(() => openTrackIds(view).length > 0, { timeout: 5000 })
  expect(openTrackIds(view)).toEqual(['vol_synteny'])
})

// The per-level form, which is what LaunchLinearSyntenyView stores after
// normalizing. Both shapes have to land in the same place.
test('a per-level init.tracks opens the synteny track on level 0', async () => {
  const view = await openWith({ views, tracks: [['vol_synteny']] })
  await when(() => openTrackIds(view).length > 0, { timeout: 5000 })
  expect(openTrackIds(view)).toEqual(['vol_synteny'])
})
