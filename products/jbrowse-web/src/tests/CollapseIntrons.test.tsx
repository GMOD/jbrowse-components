import '@testing-library/jest-dom'

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['gff3tabix_genes'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('collapse introns on gene feature', async () => {
  const user = userEvent.setup()
  const { view, session, findByText } = await createView(config)

  await view.navToLocString('ctgA:907..10,000')
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await findAnyDisplayPainted(delay)

  const label = await screen.findByTestId('feature-name-EDEN', ...opts)
  fireEvent.contextMenu(label)

  fireEvent.click(await findByText('Collapse introns', ...opts))
  await findByText('Collapse introns of EDEN', ...opts)
  fireEvent.click(await findByText('Open in new view', ...opts))

  await waitFor(
    () => {
      expect(session.views.length).toBe(2)
    },
    { timeout: 10000 },
  )

  const newView = session.views[1] as LinearGenomeViewModel

  await waitFor(
    () => {
      expect(newView.initialized).toBe(true)
    },
    { timeout: 10000 },
  )

  expect(newView.displayedRegions.length).toBeGreaterThan(1)
  for (const region of newView.displayedRegions) {
    expect(region.refName).toBe('ctgA')
  }
}, 60000)

test('collapse introns dialog lists the transcripts to scope to', async () => {
  const user = userEvent.setup()
  const { view, findByText } = await createView(config)

  await view.navToLocString('ctgA:907..10,000')
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await findAnyDisplayPainted(delay)

  const label = await screen.findByTestId('feature-name-EDEN', ...opts)
  fireEvent.contextMenu(label)

  fireEvent.click(await findByText('Collapse introns', ...opts))
  await findByText('Collapse introns of EDEN', ...opts)

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Transcript' }))
  const listbox = within(await screen.findByRole('listbox', ...opts))

  expect(listbox.getByText(/All transcripts \(3\)/)).toBeInTheDocument()
  expect(listbox.getByText(/^EDEN\.1 \(/)).toBeInTheDocument()
  expect(listbox.getByText(/^EDEN\.2 \(/)).toBeInTheDocument()
  expect(listbox.getByText(/^EDEN\.3 \(/)).toBeInTheDocument()
}, 60000)
