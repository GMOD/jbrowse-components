import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'
import { when } from 'mobx'

import AddRowDialog from './AddRowDialog.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'

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

// A two-row volvox/volvox2 view. `datasets` are extra synteny tracks the
// session holds; the view itself is opened without one, so what the dialog
// offers is decided purely by them.
async function openDialog(datasets: string[][]) {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addAssemblyConf(assembly('volvox3'))
  for (const [i, assemblyNames] of datasets.entries()) {
    session.addTrackConf({
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
    init: { views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }] },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )

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

  expect(screen.getByRole('combobox', { name: 'Synteny dataset' })).toBeTruthy()
  expect(screen.queryByText(/No synteny dataset in this session/)).toBeNull()
})

// `ghost` is named by the dataset and configured by nothing. Adding that row
// fails its init with "Assembly ghost not found", which sets the view's error,
// and showImportForm reads the view's error — so the option the dialog offered
// swapped the user's working stack for the import form. An option that cannot
// be opened is not an option.
test('a dataset naming an unloaded assembly is not offered', async () => {
  await openDialog([['volvox2', 'ghost']])

  expect(screen.queryByRole('combobox', { name: 'Synteny dataset' })).toBeNull()
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
