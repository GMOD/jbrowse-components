import { render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer'
import { App } from './loaderUtil'



// @ts-ignore
global.nodeImage = Image
// @ts-ignore
global.nodeCreateCanvas = createCanvas

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )



const delay = { timeout: 20000 }

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
    expect((elt as HTMLInputElement).value).toBe('ctgA:5,999..6,999')
  }, delay)
  await findByText('volvox-sorted.bam (contigA LinearPileupDisplay)')
}, 40000)

test('nonexist', async () => {
  console.error = jest.fn()
  const { findByText, findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&loc=ctgA:6000-7000&assembly=volvox&tracks=volvox_bam_pileup,nonexist" />,
  )

  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:5,999..6,999')
  }, delay)
  await findByText('volvox-sorted.bam (contigA LinearPileupDisplay)')
  await findByText(/Could not resolve identifiers: nonexist/)
}, 40000)
