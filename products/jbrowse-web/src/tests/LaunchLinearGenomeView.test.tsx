import { render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const delay = { timeout: 10000 }

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
  await findByText(/Could not resolve identifiers: nonexist/)
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
