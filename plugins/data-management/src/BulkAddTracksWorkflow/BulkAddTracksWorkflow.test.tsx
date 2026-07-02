import { readConfObject } from '@jbrowse/core/configuration'
import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render } from '@testing-library/react'

import BulkAddTracksWorkflow from './BulkAddTracksWorkflow.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function getSession() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 10 },
    ],
  })
  const model = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  return { session, model }
}

function pasteUrls(
  getByLabelText: (text: RegExp) => HTMLElement,
  urls: string,
) {
  fireEvent.change(getByLabelText(/File URLs/), { target: { value: urls } })
}

test('pairs a data file with its index and offers to add one track', () => {
  const { model } = getSession()
  const { getByLabelText, getByRole, getByText } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(getByLabelText, 'https://x.com/a.bam\nhttps://x.com/a.bam.bai')

  // the .bam.bai is paired, not counted as its own track
  expect(getByRole('button', { name: 'Add 1 track' })).toBeTruthy()
  expect(getByText('a.bam.bai')).toBeTruthy()
})

test('a URL pasted multiple times collapses to a single row', () => {
  const { model } = getSession()
  const { getByLabelText, getByRole } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(
    getByLabelText,
    'https://x.com/a.bam\nhttps://x.com/a.bam\nhttps://x.com/a.bam',
  )

  expect(getByRole('button', { name: 'Add 1 track' })).toBeTruthy()
})

test('an orphan index with no data file is reported once, not double-counted', () => {
  const { model } = getSession()
  const { getByLabelText, getByText, getByRole } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  // the same orphan index pasted twice must still report a single orphan
  pasteUrls(getByLabelText, 'https://x.com/o.tbi\nhttps://x.com/o.tbi')

  expect(
    getByText(/1 index file had no matching data file and was ignored/),
  ).toBeTruthy()
  expect(getByRole('button', { name: 'Add 0 tracks' })).toBeTruthy()
})

test('removing a row drops it from the addable set', () => {
  const { model } = getSession()
  const { getByLabelText, getByRole, getAllByLabelText } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(getByLabelText, 'https://x.com/a.bam\nhttps://x.com/b.bam')
  expect(getByRole('button', { name: 'Add 2 tracks' })).toBeTruthy()

  fireEvent.click(getAllByLabelText('Remove track')[0]!)
  expect(getByRole('button', { name: 'Add 1 track' })).toBeTruthy()
})

test('an unrecognized file type is flagged and not added', () => {
  const { model } = getSession()
  const { getByLabelText, getByText, getByRole } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(getByLabelText, 'https://x.com/mystery.qqq')

  expect(getByText(/will not be added/)).toBeTruthy()
  expect(getByRole('button', { name: 'Add 0 tracks' })).toBeTruthy()
})

test('warns about ftp urls that JBrowse cannot access', () => {
  const { model } = getSession()
  const { getByLabelText, getByText } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(getByLabelText, 'ftp://x.com/a.bam')

  expect(getByText(/ftp protocol/)).toBeTruthy()
})

test('submitting adds the tracks to the session', () => {
  const { session, model } = getSession()
  const before = session.sessionTracks.length
  const { getByLabelText, getByRole } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(getByLabelText, 'https://x.com/a.bam\nhttps://x.com/a.bam.bai')

  // assembly defaults to the open view's assembly, so submit is enabled
  fireEvent.click(getByRole('button', { name: 'Add 1 track' }))
  expect(session.sessionTracks.length).toBe(before + 1)
  const added = session.sessionTracks.at(-1)
  expect(readConfObject(added, 'type')).toBe('AlignmentsTrack')
  expect(readConfObject(added, 'assemblyNames')).toEqual(['volMyt1'])
  // the .bam.bai was paired into the adapter, not added as its own track
  const adapter = readConfObject(added, 'adapter')
  expect(adapter.index.location.uri).toBe('https://x.com/a.bam.bai')
})

test('notifies when submitted tracks are for an assembly not open in the view', () => {
  const { session, model } = getSession()
  // Add a second assembly then target it — the open view stays on volMyt1
  session.addAssemblyConf({
    name: 'hg38',
    sequence: {
      trackId: 'ref-hg38',
      type: 'ReferenceSequenceTrack',
      adapter: { type: 'FromConfigSequenceAdapter', features: [] },
    },
  })
  model.setAssembly('hg38')

  const notifySpy = jest.spyOn(session, 'notify')
  const { getByLabelText, getByRole } = render(
    <BulkAddTracksWorkflow model={model} switchWorkflow={() => {}} />,
  )
  pasteUrls(getByLabelText, 'https://x.com/a.bam')
  fireEvent.click(getByRole('button', { name: 'Add 1 track' }))

  expect(notifySpy).toHaveBeenCalledWith(
    expect.stringContaining('hg38'),
    'warning',
  )
})
