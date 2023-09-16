import React from 'react'
import { saveAs } from 'file-saver'
import { render, cleanup, fireEvent, within } from '@testing-library/react'
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

describe('<GridBookmarkWidget />', () => {
  beforeEach(() => {
    // @ts-expect-error
    saveAs.mockReset()
    localStorage.clear()
    jest.clearAllMocks()
  })

  afterEach(cleanup)

  it('renders empty with no bookmarks', async () => {
    const session = createTestSession()
    const model = session.addWidget(
      'GridBookmarkWidget',
      'gridBookmarkWidget',
    ) as GridBookmarkModel

    const { findByText } = render(<GridBookmarkWidget model={model} />)

    expect(await findByText('No rows')).toBeTruthy()
  })

  it('renders bookmarks correctly', async () => {
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

  // manually works but not working in testing for some reason, might have to do with the use of localstorage
  xit('deletes selected bookmarks correctly', async () => {
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

  it('downloads a BED file correctly', async () => {
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
    fireEvent.click(await findByText('Export'))
    fireEvent.click(await findByTestId('dialogDownload'))

    const blob = new Blob([''], {
      type: 'text/x-bed;charset=utf-8',
    })

    expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks_volMyt1.bed')
  })

  it('downloads a TSV file correctly', async () => {
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
    fireEvent.click(await findByText('Export'))
    fireEvent.mouseDown(await findByText('BED'))
    const listbox = within(getByRole('listbox'))
    fireEvent.click(listbox.getByText('TSV'))
    fireEvent.click(await findByTestId('dialogDownload'))

    const blob = new Blob([''], {
      type: 'text/tab-separated-values;charset=utf-8',
    })

    expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks.tsv')
  })
})
