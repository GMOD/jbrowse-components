import React from 'react'
import { saveAs } from 'file-saver'
import { render, cleanup, fireEvent, within } from '@testing-library/react'

import { createTestSession } from '@jbrowse/web/src/rootModel'

import GridBookmarkWidget from './GridBookmarkWidget'

// need to mock out data grid and force all columns to render
// https://github.com/mui-org/material-ui-x/issues/1151
jest.mock('@material-ui/data-grid', () => {
  const { DataGrid } = jest.requireActual('@material-ui/data-grid')
  return {
    ...jest.requireActual('@material-ui/data-grid'),
    DataGrid: props => {
      return <DataGrid {...props} columnBuffer={6} />
    },
  }
})

jest.mock('file-saver', () => {
  return {
    ...jest.requireActual('file-saver'),
    saveAs: jest.fn(),
  }
})

describe('<GridBookmarkWidget />', () => {
  let session
  let model

  beforeEach(() => {
    session = createTestSession()
    model = session.addWidget('GridBookmarkWidget', 'gridBookmarkWidget')
    saveAs.mockReset()
  })

  afterEach(cleanup)

  it('renders empty with no bookmarks', async () => {
    const { findByText } = render(<GridBookmarkWidget model={model} />)

    expect(await findByText('No rows')).toBeTruthy()
  })

  it('renders bookmarks correctly', async () => {
    model.addBookmark({
      refName: 'chr1',
      start: 1,
      end: 12,
      assemblyName: 'hg19',
    })

    const { findByText } = render(<GridBookmarkWidget model={model} />)

    expect(await findByText('chr1:2..12')).toBeTruthy()
  })

  it('deletes individual bookmarks correctly', async () => {
    model.addBookmark({
      refName: 'chr1',
      start: 1,
      end: 12,
      assemblyName: 'hg19',
    })

    const { findByText, findByTestId } = render(
      <GridBookmarkWidget model={model} />,
    )

    fireEvent.click(await findByTestId('deleteBookmark'))
    fireEvent.click(await findByText('Confirm'))

    expect(await findByText('No rows')).toBeTruthy()
  })

  it('clears all bookmarks correctly', async () => {
    model.addBookmark({
      refName: 'chr1',
      start: 1,
      end: 12,
      assemblyName: 'hg19',
    })

    const { findByText } = render(<GridBookmarkWidget model={model} />)

    fireEvent.click(await findByText('Clear'))
    fireEvent.click(await findByText('Confirm'))

    expect(await findByText('No rows')).toBeTruthy()
  })

  it('downloads a BED file correctly', async () => {
    model.addBookmark({
      refName: 'chr1',
      start: 1,
      end: 12,
      assemblyName: 'hg19',
    })

    const { findByText, findByTestId } = render(
      <GridBookmarkWidget model={model} />,
    )

    fireEvent.click(await findByText('Download'))
    fireEvent.click(await findByTestId('dialogDownload'))

    const blob = new Blob([''], {
      type: 'text/x-bed;charset=utf-8',
    })

    expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks_hg19.bed')
  })

  it('downloads a TSV file correctly', async () => {
    model.addBookmark({
      refName: 'chr1',
      start: 1,
      end: 12,
      assemblyName: 'hg19',
    })

    const { findByText, findByTestId, getByRole } = render(
      <GridBookmarkWidget model={model} />,
    )

    fireEvent.click(await findByText('Download'))
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
