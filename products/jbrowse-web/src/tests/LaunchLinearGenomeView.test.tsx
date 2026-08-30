import { render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'
import { suppressTeardownNoise } from './teardownNoise.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const delay = { timeout: 10000 }

suppressTeardownNoise()

utilizeFetchMockForTest()

test('can use a spec url for lgv', async () => {
  const { findByText, findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&loc=ctgA:6000-7000&assembly=volvox&tracks=volvox_bam_pileup" />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:6,000..7,000')
  }, delay)
  await findByText('volvox-sorted.bam (contigA LinearPileupDisplay)')
}, 60000)

test('can use a spec gene name for lgv', async () => {
  const { findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&loc=EDEN&assembly=volvox&tracks=volvox_bam_pileup" />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:1..10,590')
  }, delay)
}, 60000)

test('nonexist', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const { findByText, findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&loc=ctgA:6000-7000&assembly=volvox&tracks=volvox_bam_pileup,nonexist" />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:6,000..7,000')
  }, delay)
  await findByText('volvox-sorted.bam (contigA LinearPileupDisplay)')
  await findByText(/Could not resolve identifier "nonexist"/)
}, 60000)

test('shows whole genome when no loc is specified', async () => {
  const { findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&assembly=volvox" />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:1..50,001 ctgB:1..6,079')
  }, delay)
}, 60000)

test('spec url with multiple tracks opens the view and shows every track', async () => {
  // mirrors the "Volvox (genes + multi-wiggle + BAM)" no-config sample link:
  // a spec session carrying a loc plus several tracks. guards the
  // loader -> loadSessionSpec -> LaunchView-LinearGenomeView -> init autorun
  // chain against silently dropping the view or any of its tracks.
  const { findByText, findByPlaceholderText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":["gff3tabix_genes","volvox_bam_pileup"]}]}' />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:1..50,000')
  }, delay)
  await findByText('volvox-sorted.bam (contigA LinearPileupDisplay)', {}, delay)
  await findByText(/GFF3Tabix genes/, {}, delay)
}, 60000)

test('unknown view type in spec surfaces an error instead of failing silently', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"NonexistentView","assembly":"volvox"}]}' />,
  )

  await findByText(
    /Unknown view type\(s\) in session spec: NonexistentView/,
    {},
    delay,
  )
}, 60000)

test('spec url can carry its own assembly via sessionAssemblies', async () => {
  // a self-contained spec: an assembly the hosted config does not define,
  // supplied inline, plus a view launched on it. guards the
  // loadSessionSpec -> addSessionAssembly wiring so a novel assembly resolves
  // without being baked into the config first.
  const spec = {
    sessionAssemblies: [
      {
        name: 'volvox_session',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'volvox_session_refseq',
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'test_data/volvox/volvox.2bit',
          },
        },
      },
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox_session',
        loc: 'ctgA:1-50000',
      },
    ],
  }
  const { findByPlaceholderText } = render(
    <App
      search={`?config=test_data/volvox/config_main_thread.json&session=spec-${JSON.stringify(spec)}`}
    />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:1..50,000')
  }, delay)
}, 60000)

// &extendSession=true layers the jb1-style params onto the config's own
// defaultSession. config_spec.json's view carries a pending `init`, so it has no
// displayedRegions yet and therefore no assemblyNames: the URL's loc used to be
// dropped outright for want of an assembly to resolve it against, and supplying
// an &assembly= instead replaced the pending init, losing the tracks it opened.
test('extendSession navigates within a defaultSession init, keeping its tracks', async () => {
  // the failed load below reports itself; taken here rather than printed
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { findByTestId, findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_spec.json&extendSession=true&loc=ctgB:1-100" />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgB:1..100')
  }, delay)
  // the defaultSession's own init.tracks survived the merge: its track is open in
  // the view. Asserted on the drag handle rather than the track name, which this
  // config also renders in the track selector it opens — that copy is there
  // whether the track is open or not. The track's data cannot load here (the
  // config has no MainThreadRpcDriver and the worker is mocked out), which is
  // beside the point; that it opened at all is the claim.
  await findByTestId(
    'dragHandle-integration_test-volvox_cram_alignments_ctga',
    {},
    delay,
  )
  expect(reported).toHaveBeenCalled()
  reported.mockRestore()
}, 60000)
