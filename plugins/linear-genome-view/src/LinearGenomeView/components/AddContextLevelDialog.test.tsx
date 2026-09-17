import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { when } from 'mobx'

import AddContextLevelDialog from './AddContextLevelDialog.tsx'

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
  // the markup a track config may carry, which the label has to come back
  // without
  session.addSessionTrackConf(trackConf('reads', 'Reads (<i>HTML italic</i>)'))
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

function levelTrackIds(view: LinearGenomeViewModel) {
  return levels(view)[0]!.tracks.map(t => t.configuration.trackId)
}

// Two controls, and neither is a span: the level arrives ten times the view and
// the wheel changes it from there.
test('Add alone opens a level ten times the view, above the tracks', async () => {
  const { view } = await setup()
  const { getByRole, queryByLabelText } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  expect(queryByLabelText(/width/i)).toBeNull()
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(levels(view).map(l => l.windowWidthBp)).toEqual([80_000])
  expect(view.contextLevelsBelow).toBe(false)
})

// The level is a wider view of what is on screen, so the dialog opens with the
// view's own tracks checked and Add alone carries them over
test('the tracks the view shows are the ones checked', async () => {
  const { view } = await setup()
  await view.launchTrack('genes')
  const { getByRole } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  expect(
    (getByRole('checkbox', { name: 'Gene annotations' }) as HTMLInputElement)
      .checked,
  ).toBe(true)
  expect(
    (getByRole('checkbox', { name: 'Reads (HTML italic)' }) as HTMLInputElement)
      .checked,
  ).toBe(false)
  fireEvent.click(getByRole('button', { name: 'Add' }))
  await waitFor(() => {
    expect(levelTrackIds(view)).toEqual(['genes'])
  })
})

// A session's list runs to tens of tracks, so the checked rows have to be the
// ones on screen: 'reads' is configured after 'genes' and comes first here
// because the view is showing it
test("the view's own tracks head the list", async () => {
  const { view } = await setup()
  await view.launchTrack('reads')
  // baseElement, not container: a Dialog renders into a portal off document.body
  const { baseElement } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  const text = baseElement.textContent
  expect(text.indexOf('Reads (HTML italic)')).toBeLessThan(
    text.indexOf('Gene annotations'),
  )
})

test('a name carrying markup is checked by the text a reader sees', async () => {
  const { view } = await setup()
  const { getByRole, getByTestId } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  fireEvent.click(getByRole('checkbox', { name: 'Reads (HTML italic)' }))
  fireEvent.change(getByTestId('context-level-track-filter'), {
    target: { value: 'italic' },
  })
  // the filter reads the same stripped name, so a tag cannot hide a row from it
  expect(getByRole('checkbox', { name: 'Reads (HTML italic)' })).toBeTruthy()
  fireEvent.click(getByRole('button', { name: 'Add' }))
  await waitFor(() => {
    expect(levelTrackIds(view)).toEqual(['reads'])
  })
})

test('a track unchecked here stays off the level', async () => {
  const { view } = await setup()
  await view.launchTrack('genes')
  const { getByRole } = render(
    <AddContextLevelDialog model={view} handleClose={() => {}} />,
  )
  fireEvent.click(getByRole('checkbox', { name: 'Gene annotations' }))
  fireEvent.click(getByRole('button', { name: 'Add' }))
  expect(levels(view)[0]!.tracks).toEqual([])
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
