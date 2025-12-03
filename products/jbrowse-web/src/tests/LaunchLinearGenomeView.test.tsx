import { render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer'
import { App } from './loaderUtil'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 10000 }

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

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

test('nonexist', async () => {
  console.error = jest.fn()
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
