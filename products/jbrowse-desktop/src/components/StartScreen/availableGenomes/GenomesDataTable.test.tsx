import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import GenomesDataTable from './GenomesDataTable.tsx'

import type { Fav } from '../types.ts'

const UCSC_URL = 'https://example.com/ucsc.json'

const categories = {
  categories: [{ key: 'ucsc', title: 'UCSC Main Genomes', url: UCSC_URL }],
}

const ucscRows = [
  {
    accession: 'hg38',
    name: 'hg38',
    organism: 'Human',
    description: 'Dec. 2013 (GRCh38/hg38)',
    scientificName: 'Homo sapiens',
    commonName: 'Human',
    taxonId: 9606,
    orderKey: 1,
    jbrowseConfig: 'https://jbrowse.org/ucsc/hg38/config.json',
    jbrowseMinimalConfig: 'https://jbrowse.org/ucsc/hg38/minimal.json',
  },
  {
    accession: 'mm39',
    name: 'mm39',
    organism: 'Mouse',
    description: 'Jun. 2020 (GRCm39/mm39)',
    scientificName: 'Mus musculus',
    commonName: 'Mouse',
    taxonId: 10090,
    orderKey: 2,
    jbrowseConfig: 'https://jbrowse.org/ucsc/mm39/config.json',
  },
]

const bodyFor = (url: string) =>
  url === UCSC_URL
    ? ucscRows
    : url.includes('categories')
      ? categories
      : { mammal: [9606, 10090] }

beforeEach(() => {
  globalThis.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(bodyFor(url)),
    }),
  ) as unknown as typeof fetch
  localStorage.clear()
})

function setup(favorites: Fav[] = []) {
  const launch = jest.fn()
  const onClose = jest.fn()
  render(
    // the start screen renders under the app's theme, which useSearchHighlight
    // reads its highlight color from
    <ThemeProvider theme={createJBrowseTheme()}>
      <GenomesDataTable
        favorites={favorites}
        setFavorites={jest.fn()}
        launch={launch}
        onClose={onClose}
      />
    </ThemeProvider>,
  )
  return { launch, onClose }
}

test('lists the genomes of the selected group', async () => {
  setup()
  expect(await screen.findByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Jun. 2020 (GRCm39/mm39)')).toBeTruthy()
  expect(screen.getByText('Showing 1–2 of 2 in this group')).toBeTruthy()
})

test('launching passes the config url and closes the dialog', async () => {
  const { launch, onClose } = setup()
  const launchLinks = await screen.findAllByText('launch')
  fireEvent.click(launchLinks[0]!)
  expect(launch).toHaveBeenCalledWith([
    'https://jbrowse.org/ucsc/hg38/config.json',
  ])
  expect(onClose).toHaveBeenCalled()
})

test('a search that matches nothing says so instead of showing a blank table', async () => {
  setup()
  const search = await screen.findByPlaceholderText('Search genomes...')

  fireEvent.change(search, { target: { value: 'mouse' } })
  await waitFor(() => {
    expect(screen.queryByText('Dec. 2013 (GRCh38/hg38)')).toBeNull()
  })
  expect(screen.getByText('Jun. 2020 (GRCm39/mm39)')).toBeTruthy()
  expect(
    screen.getByText('Showing 1–1 of 1 matching (2 in this group)'),
  ).toBeTruthy()

  fireEvent.change(search, { target: { value: 'no such genome' } })
  expect(
    await screen.findByText('No genomes match the current search and filters'),
  ).toBeTruthy()
  expect(screen.getByText('Showing 0 matching (2 in this group)')).toBeTruthy()
})

test('sort headers are buttons and expose their direction', async () => {
  setup()
  const organism = await screen.findByRole('button', { name: 'Organism' })

  fireEvent.click(organism)
  await waitFor(() => {
    expect(
      screen
        .getByRole('columnheader', { name: /Organism/ })
        .getAttribute('aria-sort'),
    ).toBe('ascending')
  })

  fireEvent.click(screen.getByRole('button', { name: /Organism/ }))
  await waitFor(() => {
    expect(
      screen
        .getByRole('columnheader', { name: /Organism/ })
        .getAttribute('aria-sort'),
    ).toBe('descending')
  })
})
