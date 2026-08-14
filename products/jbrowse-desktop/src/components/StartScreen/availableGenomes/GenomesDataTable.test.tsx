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
    await screen.findByText(/No matches in UCSC Main Genomes/),
  ).toBeTruthy()
  expect(screen.getByText('Showing 0 matching (2 in this group)')).toBeTruthy()
})

test('running out of matches in a group offers the search across all of them', async () => {
  const { launch } = setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })

  // the 7.5MB index is not fetched until the user asks for the wider search
  await screen.findByText(/No matches in UCSC Main Genomes/)
  expect(fetched).not.toContain(SEARCH_INDEX_URL)

  fireEvent.click(screen.getByText('search all groups'))

  // a hit from a group other than the selected one, labelled with its group
  expect(await screen.findByText('Ailuropoda melanoleuca')).toBeTruthy()
  expect(screen.getByText('UCSC GenArk - Primates')).toBeTruthy()
  expect(screen.getByText('GCF_000004335.4')).toBeTruthy()
  expect(
    screen.getByText('Showing 1–1 of 1 matching (2 across all groups)'),
  ).toBeTruthy()

  // launchable via a config url rebuilt from the accession alone
  fireEvent.click(screen.getByText('launch'))
  expect(launch).toHaveBeenCalledWith([
    'https://jbrowse.org/hubs/genark/GCF/000/004/335/GCF_000004335.4/config.json',
  ])
})

test('clearing the query returns to browsing the selected group', async () => {
  setup()
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'panda' } })
  fireEvent.click(await screen.findByText('search all groups'))
  expect(await screen.findByText('Ailuropoda melanoleuca')).toBeTruthy()

  fireEvent.change(search, { target: { value: '' } })
  expect(await screen.findByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Showing 1–2 of 2 in this group')).toBeTruthy()
})

// searchAllGroups only searches, so the menu's filters have to be applied to
// its hits separately — they used to be offered but silently ignored here
test('the favorites filter applies to cross-group hits, not just the group', async () => {
  setup([
    {
      id: 'GCF_000004335.4',
      shortName: 'panda',
      commonName: 'giant panda',
      description: 'giant panda',
      jbrowseConfig: 'https://example.com/panda/config.json',
    },
  ])
  const search = await screen.findByPlaceholderText('Search genomes...')
  fireEvent.change(search, { target: { value: 'a' } })

  // the menu stays open across a settings row (it's a checkbox), so both
  // toggles are clicked from the one opening
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Search all groups'))

  // both index rows match 'a', and only one of them is a favorite
  expect(await screen.findByText('Ailuropoda melanoleuca')).toBeTruthy()
  expect(screen.getByText('Homo sapiens')).toBeTruthy()

  fireEvent.click(await screen.findByText('Show favorites only'))

  await waitFor(() => {
    expect(screen.queryByText('Homo sapiens')).toBeNull()
  })
  expect(screen.getByText('Ailuropoda melanoleuca')).toBeTruthy()
})

// a selection is keyed by accession and deliberately outlives the query that
// surfaced each row, so launching has to resolve it against more than the hits
// currently on screen
test('a cross-group selection built across two searches launches both', async () => {
  const { launch } = setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })

  // both toggles clear the selection, so they have to come before it
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Enable multiple selection'))
  fireEvent.click(await screen.findByText('Search all groups'))
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
  // [0] is the header select-all; [1] is the single hit's own checkbox
  fireEvent.click(screen.getAllByRole('checkbox')[1]!)

  fireEvent.click(screen.getByText('Open 2 selected'))
  expect(launch.mock.calls[0]![0].toSorted()).toEqual([
    'https://jbrowse.org/hubs/genark/GCF/000/004/335/GCF_000004335.4/config.json',
    'https://jbrowse.org/ucsc/hg38/config.json',
  ])
})

test('select-all adds the rows on screen without dropping the rest', async () => {
  setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Enable multiple selection'))
  fireEvent.click(await screen.findByText('Search all groups'))
  // a settings row leaves the menu up, and the menu is a modal — everything
  // behind it is aria-hidden — so dismiss it before querying the table
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

// the index is only what a cross-group *search* reads, so failing to load it
// must not take down the group the user is browsing
test('a failed search index does not block browsing the selected group', async () => {
  failing.add(SEARCH_INDEX_URL)
  setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Search all groups'))

  await waitFor(() => {
    expect(fetched).toContain(SEARCH_INDEX_URL)
  })
  expect(screen.getByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Showing 1–2 of 2 in this group')).toBeTruthy()
})

// The NCBI status filter is only offered where its fields exist, and it used to
// go on being applied where it isn't offered. Leaving the cross-group search on
// a UCSC group was three clicks to a table stuck empty: `refseq` testing db
// names for the `GCF_` prefix they never carry, with the menu item that set it
// no longer on screen to unset it.
test('an NCBI filter left over from a cross-group search is not applied where it cannot match', async () => {
  setup()
  const settings = await screen.findByRole('button', { name: 'Table settings' })
  fireEvent.click(settings)
  fireEvent.click(await screen.findByText('Search all groups'))

  fireEvent.click(await screen.findByText('Filter by NCBI status'))
  fireEvent.click(await screen.findByText('RefSeq only'))

  // back to the one group, where the filter is no longer offered
  fireEvent.click(screen.getByText('Search all groups'))
  fireEvent.keyDown(screen.getAllByRole('menu')[0]!, { key: 'Escape' })

  expect(await screen.findByText('Dec. 2013 (GRCh38/hg38)')).toBeTruthy()
  expect(screen.getByText('Jun. 2020 (GRCm39/mm39)')).toBeTruthy()
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
