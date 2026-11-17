import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import GenomesDataTable from './GenomesDataTable.tsx'
import { SEARCH_INDEX_URL } from './searchIndex.ts'

import type { Fav } from '../types.ts'

const UCSC_URL = 'https://example.com/ucsc.json'

const categories = {
  categories: [
    { key: 'ucsc', title: 'UCSC Main Genomes', url: UCSC_URL },
    {
      key: 'primates',
      title: 'UCSC GenArk - Primates',
      url: 'https://example.com/primates.json',
    },
  ],
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

// [accession, commonName, scientificName, assemblyName, assemblyStatus, source,
//  taxonId, ncbiStatus, year, rank, altAccession]
const searchIndex = [
  ['hg38', 'Human', 'Homo sapiens', 'GRCh38', '', 'ucsc', 9606, 0, 2013, 2, ''],
  [
    'GCF_000004335.4',
    'giant panda',
    'Ailuropoda melanoleuca',
    'ASM433v2',
    'Chromosome',
    'primates',
    9646,
    1,
    2009,
    0,
    '',
  ],
]

let fetched: string[] = []
let failing = new Set<string>()

const bodyFor = (url: string) =>
  url === UCSC_URL
    ? ucscRows
    : url === SEARCH_INDEX_URL
      ? searchIndex
      : categories

beforeEach(() => {
  fetched = []
  failing = new Set()
  globalThis.fetch = jest.fn((url: string) => {
    fetched.push(url)
    return Promise.resolve({
      ok: !failing.has(url),
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve(''),
      json: () => Promise.resolve(bodyFor(url)),
    })
  }) as unknown as typeof fetch
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

test('a search covers every group, and the index waits for the first query', async () => {
  const { launch } = setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  // the 7.5MB index is not fetched for browsing
  expect(fetched).not.toContain(SEARCH_INDEX_URL)

  fireEvent.change(search, { target: { value: 'panda' } })

  // a hit from a group other than the selected one, labelled with its group
  expect(await screen.findByText('Ailuropoda melanoleuca')).toBeTruthy()
  expect(screen.getByText('UCSC GenArk - Primates')).toBeTruthy()
  expect(screen.getByText('GCF_000004335.4')).toBeTruthy()
  expect(
    screen.getByText('Showing 1–1 of 1 matching (2 across all groups)'),
  ).toBeTruthy()
  expect(screen.getByText('All groups')).toBeTruthy()

  // launchable via a config url rebuilt from the accession alone
  fireEvent.click(screen.getByText('launch'))
  expect(launch).toHaveBeenCalledWith([
    'https://jbrowse.org/hubs/genark/GCF/000/004/335/GCF_000004335.4/config.json',
  ])
})

test('a search that matches nothing says so instead of showing a blank table', async () => {
  setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'no such genome' } })
  expect(
    await screen.findByText('No genomes match the current search and filters'),
  ).toBeTruthy()
  expect(
    screen.getByText('Showing 0 matching (2 across all groups)'),
  ).toBeTruthy()
})

test('clearing the query returns to browsing the selected group', async () => {
  setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  expect(await screen.findByText('Ailuropoda melanoleuca')).toBeTruthy()

  fireEvent.change(search, { target: { value: '' } })
  expect(await screen.findByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Showing 1–2 of 2 in this group')).toBeTruthy()
})

// a selection is keyed by accession and deliberately outlives the query that
// surfaced each row, so launching has to resolve it against more than the hits
// currently on screen
test('a selection built across two searches launches both', async () => {
  const { launch } = setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Enable multiple selection'))
  // a settings row leaves the menu up, and the menu is a modal — everything
  // behind it is aria-hidden — so dismiss it before querying the table
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

  const search = screen.getByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  await screen.findByText('Ailuropoda melanoleuca')
  // [0] is the header select-all; [1] is the single hit's own checkbox
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)

  fireEvent.change(search, { target: { value: 'homo' } })
  await screen.findByText('Homo sapiens')
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)

  fireEvent.click(screen.getByText('Open 2 selected'))
  expect(launch.mock.calls[0]![0].toSorted()).toEqual([
    'https://jbrowse.org/hubs/genark/GCF/000/004/335/GCF_000004335.4/config.json',
    'https://jbrowse.org/ucsc/hg38/config.json',
  ])
})

test('a pick from another group still launches after the query is cleared', async () => {
  const { launch } = setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Enable multiple selection'))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

  const search = screen.getByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  await screen.findByText('Ailuropoda melanoleuca')
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)

  // back to browsing the UCSC group, which has no panda
  fireEvent.change(search, { target: { value: '' } })
  await screen.findByText('Dec. 2013 (GRCh38/hg38)')
  fireEvent.click(screen.getByText('Open 1 selected'))
  expect(launch).toHaveBeenCalledWith([
    'https://jbrowse.org/hubs/genark/GCF/000/004/335/GCF_000004335.4/config.json',
  ])
})

test('select-all adds the rows on screen without dropping the rest', async () => {
  setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Enable multiple selection'))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

  const search = screen.getByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  await screen.findByText('Ailuropoda melanoleuca')
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)
  expect(screen.getByText('Open 1 selected')).toBeTruthy()

  // the header checkbox now covers a different hit; panda is off screen
  fireEvent.change(search, { target: { value: 'homo' } })
  await screen.findByText('Homo sapiens')
  fireEvent.click(screen.getAllByRole('checkbox')[0]!)
  expect(screen.getByText('Open 2 selected')).toBeTruthy()

  // unchecking it takes back only what it added
  fireEvent.click(screen.getAllByRole('checkbox')[0]!)
  expect(screen.getByText('Open 1 selected')).toBeTruthy()
})

// the index is only what a search reads, so failing to load it must not take
// down the group the user is browsing
test('a failed search index does not block browsing the selected group', async () => {
  failing.add(SEARCH_INDEX_URL)
  setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  await waitFor(() => {
    expect(fetched).toContain(SEARCH_INDEX_URL)
  })

  fireEvent.change(search, { target: { value: '' } })
  expect(await screen.findByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Showing 1–2 of 2 in this group')).toBeTruthy()
})

// The NCBI status filter is only offered where its fields exist, and must not
// go on being applied where it isn't offered: once the query is cleared,
// `refseq` would test UCSC db names for the `GCF_` prefix they never carry and
// the table would stick empty.
test('an NCBI filter left over from a search is not applied where it cannot match', async () => {
  setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Filter by NCBI status'))
  fireEvent.click(await screen.findByText('RefSeq only'))
  expect(await screen.findByText('Ailuropoda melanoleuca')).toBeTruthy()

  fireEvent.change(search, { target: { value: '' } })
  expect(await screen.findByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Showing 1–2 of 2 in this group')).toBeTruthy()
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
