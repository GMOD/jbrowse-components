import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { when } from 'mobx'

import AddContextLevelDialog from './AddContextLevelDialog.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Gene annotations',
    type: 'FeatureTrack',
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  // the assembly manager builds its models in an autorun, and until it has, the
  // alias resolution the track list goes through answers off an empty map
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
  return view.contextLevelViews as LinearGenomeViewModel[]
}

test('the span it opens at is ten times the view, and Add uses it', async () => {
  const { view } = await setup()
  const { getByTestId, getByRole } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  expect((getByTestId('context-level-span') as HTMLInputElement).value).toBe(
    '80,000',
  )
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([80_000])
  expect(view.contextLevelsBelow).toBe(false)
})

test('a span narrower than the view says so and refuses to add', async () => {
  const { view } = await setup()
  const { getByTestId, getByRole, getByText } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  fireEvent.change(getByTestId('context-level-span'), {
    target: { value: '2kb' },
  })
  expect(getByText(/has to be wider than the current view/)).toBeTruthy()
  expect(
    (getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(levels(view)).toEqual([])
})

test('the stack goes under the tracks when the dialog says so', async () => {
  const { view } = await setup()
  const { getByRole } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  fireEvent.click(getByRole('radio', { name: 'Below the tracks' }))
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(view.contextLevelsBelow).toBe(true)
  expect(levels(view)).toHaveLength(1)
})

test('a track picked here is on the level the dialog adds', async () => {
  const { view } = await setup()
  const { getByRole } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  fireEvent.change(getByRole('combobox', { name: 'Tracks on the level' }), {
    target: { value: 'anno' },
  })
  fireEvent.click(getByRole('option', { name: 'Gene annotations' }))
  fireEvent.click(getByRole('button', { name: 'Add' }))
  const [level] = levels(view)
  await waitFor(() => {
    expect(level!.tracks).toHaveLength(1)
  })
  expect(level!.tracks[0]!.configuration.trackId).toBe('genes')
})
