import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'
import { when } from 'mobx'

import AddRowDialog from './AddRowDialog.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'
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

// A two-row volvox/volvox2 view. `datasets` are the synteny tracks the session
// holds, and `openTracks` names the ones the view itself opens on its band, so
// a test can say both what exists and what is already drawn.
async function openDialog(datasets: string[][], openTracks: string[] = []) {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addAssemblyConf(assembly('volvox3'))
  for (const [i, assemblyNames] of datasets.entries()) {
    session.addSessionTrackConf({
      type: 'SyntenyTrack',
      trackId: `dataset${i}`,
      name: `dataset ${i}`,
      assemblyNames,
      adapter: {
        type: 'PAFAdapter',
        pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
        queryAssembly: assemblyNames[0],
        targetAssembly: assemblyNames[1],
      },
    })
  }
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
      tracks: openTracks,
    },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  await when(() => bandTracks(view).length === openTracks.length, {
    timeout: 5000,
  })

  const closed = { yes: false }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AddRowDialog
        model={view}
        handleClose={() => {
          closed.yes = true
        }}
      />
    </ThemeProvider>,
  )
  return { view, closed }
}

// a level's `tracks` is a pluggableMstType array, so its element type is loose;
// naming the one member this reads keeps it checked without a cast
const bandTracks = (view: LinearSyntenyViewModel) =>
  view.levels.flatMap(
    l => l.tracks as { configuration: AnyConfigurationModel }[],
  )

// The note lived inside the `existing` branch, which is the one branch a
// session with nothing to offer never reaches: the mode starts on 'custom'
// when the option list is empty, and the radio back to it is disabled. So the
// dialog greyed out a radio and kept the reason to itself.
//
// The dataset here connects to the TOP row, which is no use — a row is only
// ever added below the bottom one — so it also pins which row the note names.
test('a session with no dataset for the bottom row says so', async () => {
  await openDialog([['volvox', 'volvox3']])

  expect(
    screen.getByText(/No synteny dataset in this session connects to volvox2/),
  ).toBeTruthy()
  expect(screen.getByLabelText('Existing dataset')).toBeDisabled()
})

// the converse: with something to pick there is a picker and no note
test('a session with a connecting dataset offers it instead', async () => {
  await openDialog([['volvox2', 'volvox3']])

  expect(screen.getByRole('combobox', { name: 'Assembly to add' })).toBeTruthy()
  expect(screen.queryByText(/No synteny dataset in this session/)).toBeNull()
})

// `ghost` is named by the dataset and configured by nothing. Adding that row
// fails its init with "Assembly ghost not found", which sets the view's error,
// and showImportForm reads the view's error — so the option the dialog offered
// swapped the user's working stack for the import form. An option that cannot
// be opened is not an option.
test('a dataset naming an unloaded assembly is not offered', async () => {
  await openDialog([['volvox2', 'ghost']])

  // "via <dataset>" is the dataset picker's own text, and the assembly Select
  // the custom branch falls back to shares its label — one field, one name for
  // it, whichever mode answers it
  expect(screen.queryByText(/via/)).toBeNull()
  expect(
    screen.getByText(/No synteny dataset in this session connects to volvox2/),
  ).toBeTruthy()
})

// the two halves the tests above cover separately, joined: what the picker
// offers is what Add appends, on the level the dataset spans
test('Add appends the picked dataset as a new bottom row', async () => {
  const { view, closed } = await openDialog([['volvox2', 'volvox3']])

  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  // the row and its level are the click's own work
  expect(view.views.length).toBe(3)
  expect(view.levels.length).toBe(2)
  expect(view.levels[1]!.tracks.length).toBe(1)
  expect(closed.yes).toBe(true)

  // the assembly is not: appendRow hands the row an LGV `init`, whose afterAttach
  // autorun resolves the assembly and navigates it
  await when(() => view.views.at(-1)!.assemblyNames[0] === 'volvox3')
  expect(view.views.map(v => v.assemblyNames[0])).toEqual([
    'volvox',
    'volvox2',
    'volvox3',
  ])
})

// nothing to pick means nothing to add, so the button cannot be live — the
// custom branch it lands in needs an uploaded file first
test('Add is disabled with no dataset and no upload', async () => {
  await openDialog([])

  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
})

// What a plain two-row view opened on its own synteny track offered: that
// track, back to the assembly already at the top. Picking it stacked the same
// alignment a second time upside down, and it was the *only* thing on offer, so
// the dialog read as if adding a row meant repeating one.
test('the dataset already drawn above is not offered back', async () => {
  await openDialog([['volvox', 'volvox2']], ['dataset0'])

  expect(screen.queryByText(/via/)).toBeNull()
  expect(
    screen.getByText(/dataset 0 already draws the band above volvox2/),
  ).toBeTruthy()
  // and not the note that claims nothing connects, which is the other reason a
  // list can be empty and a different thing to do about it
  expect(screen.queryByText(/No synteny dataset in this session/)).toBeNull()
})

// Two aligners' takes on one pair is a real stack — a band each — so a second
// dataset back to the row above stays on offer. It says where that assembly
// already is rather than pretending the row is new.
test('a second dataset back to the row above is offered, and flagged', async () => {
  await openDialog(
    [
      ['volvox', 'volvox2'],
      ['volvox', 'volvox2'],
    ],
    ['dataset0'],
  )

  expect(
    screen.getByRole('combobox', { name: 'Assembly to add' }),
  ).toHaveTextContent('volvox — via dataset 1 (already row 1)')
})

// A row names its assembly through its displayed regions, so the row this
// dialog has just added names none until it navigates — only its pending `init`
// does. Anchored to the blank name instead, the dialog matched every synteny
// dataset in the session (an empty request matches all of them) and offered to
// add the row it had just added, again.
test('the row just added anchors the dialog before it has loaded', async () => {
  const { view } = await openDialog([['volvox2', 'volvox3']])

  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(view.views.at(-1)!.assemblyNames).toEqual([])
  expect(
    screen.getByText(/dataset 0 already draws the band above volvox3/),
  ).toBeTruthy()
})
