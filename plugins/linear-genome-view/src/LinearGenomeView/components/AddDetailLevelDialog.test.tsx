import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { when } from 'mobx'

import AddDetailLevelDialog from './AddDetailLevelDialog.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function trackConf(trackId: string, name: string) {
  return {
    trackId,
    name,
    type: 'FeatureTrack',
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 1_000_000 },
        ],
      },
    },
  })
  session.addSessionTrackConf(trackConf('genes', 'Gene annotations'))
  session.addSessionTrackConf(trackConf('reads', 'Reads'))
  // the assembly manager builds its models in an autorun, and until it has, a
  // track launched here has no assembly to resolve against
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1_000_000 },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 400_000)
  return { session, view }
}

function levels(view: LinearGenomeViewModel) {
  return view.detailLevelViews as LinearGenomeViewModel[]
}

function levelTrackIds(view: LinearGenomeViewModel) {
  return levels(view)[0]!.tracks.map(t => t.configuration.trackId)
}

// One control, and it is not a span: the level arrives a tenth as wide as the
// view and the wheel changes it from there
test('Add alone opens a level a tenth of the view, under the tracks', async () => {
  const { view } = await setup()
  const { getByRole, queryByLabelText } = render(
    <AddDetailLevelDialog model={view} handleClose={() => {}} />,
  )
  expect(queryByLabelText(/width/i)).toBeNull()
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([800])
})

// The level is a closer look at what is on screen, so the box is checked and
// Add alone carries the view's tracks over
test("the view's tracks come over by default", async () => {
  const { view } = await setup()
  await view.launchTrack('genes')
  const { getByRole } = render(
    <AddDetailLevelDialog model={view} handleClose={() => {}} />,
  )
  expect(
    (
      getByRole('checkbox', {
        name: "Copy this view's tracks",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true)
  fireEvent.click(getByRole('button', { name: 'Add' }))
  await waitFor(() => {
    expect(levelTrackIds(view)).toEqual(['genes'])
  })
})

test('the box unchecked opens an empty level', async () => {
  const { view } = await setup()
  await view.launchTrack('genes')
  const { getByRole } = render(
    <AddDetailLevelDialog model={view} handleClose={() => {}} />,
  )
  fireEvent.click(getByRole('checkbox', { name: "Copy this view's tracks" }))
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(levels(view)[0]!.tracks).toEqual([])
})
