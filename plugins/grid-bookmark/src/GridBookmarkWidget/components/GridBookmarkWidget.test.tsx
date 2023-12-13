import React from 'react'
import { saveAs } from 'file-saver'
import { render, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'

import { createTestSession } from '@jbrowse/web/src/rootModel'

import GridBookmarkWidget from './GridBookmarkWidget'
import { GridBookmarkModel } from '../model'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

jest.mock('file-saver', () => {
  return {
    ...jest.requireActual('file-saver'),
    saveAs: jest.fn(),
  }
})

const opts = [{}, { timeout: 10000 }] as const

beforeEach(() => {
  // @ts-expect-error
  saveAs.mockReset()
  localStorage.clear()
  jest.clearAllMocks()
})

test('renders empty with no bookmarks', async () => {
  const session = createTestSession()
  const model = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  ) as GridBookmarkModel

  const { findByText } = render(<GridBookmarkWidget model={model} />)

  expect(await findByText('No rows')).toBeTruthy()
})

test('renders bookmarks correctly', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  const model = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  ) as GridBookmarkModel

  const bookmark = {
    refName: 'ctgA',
    start: 0,
    end: 8,
    assemblyName: 'volMyt1',
  }

  model.addBookmark(bookmark)

  const { findByText } = render(<GridBookmarkWidget model={model} />)

  expect(await findByText('ctgA:1..8')).toBeTruthy()
})

// manually works but not working in testing for some reason, might have to do
// with the use of localstorage
xtest('deletes selected bookmarks correctly', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  const model = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  ) as GridBookmarkModel

  const bookmark = {
    refName: 'ctgA',
    start: 0,
    end: 8,
    assemblyName: 'volMyt1',
  }

  model.addBookmark(bookmark)

  const { findByText, findAllByRole } = render(
    <GridBookmarkWidget model={model} />,
  )

  fireEvent.click((await findAllByRole('checkbox'))[1])
  fireEvent.click(await findByText('Delete'))
  fireEvent.click(await findByText('Confirm'))
  expect(await findByText('No rows')).toBeTruthy()
})

test('downloads a BED file correctly', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  const model = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  ) as GridBookmarkModel

  const bookmark = {
    refName: 'ctgA',
    start: 0,
    end: 8,
    assemblyName: 'volMyt1',
  }

  model.addBookmark(bookmark)

  const { findByText, findByTestId, findAllByRole } = render(
    <GridBookmarkWidget model={model} />,
  )

  fireEvent.click((await findAllByRole('checkbox'))[1])
  fireEvent.click(await findByTestId('grid_bookmark_menu', ...opts))
  fireEvent.click(await findByText('Export bookmarks', ...opts))
  fireEvent.click(await findByText(/Download/, ...opts))

  const blob = new Blob([''], {
    type: 'text/x-bed;charset=utf-8',
  })

  expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks_volMyt1.bed')
}, 20000)

test('downloads a TSV file correctly', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  const model = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  ) as GridBookmarkModel

  const bookmark = {
    refName: 'ctgA',
    start: 0,
    end: 8,
    assemblyName: 'volMyt1',
  }

  model.addBookmark(bookmark)

  const { findByText, findByTestId, getByRole, findAllByRole } = render(
    <GridBookmarkWidget model={model} />,
  )

  fireEvent.click((await findAllByRole('checkbox'))[1])
  fireEvent.click(await findByTestId('grid_bookmark_menu'))
  fireEvent.click(await findByText('Export bookmarks'))
  fireEvent.mouseDown(await findByText('BED'))
  const listbox = within(getByRole('listbox'))
  fireEvent.click(listbox.getByText('TSV'))
  fireEvent.click(await findByText(/Download/))

  const blob = new Blob([''], {
    type: 'text/tab-separated-values;charset=utf-8',
  })

  expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks.tsv')
})
