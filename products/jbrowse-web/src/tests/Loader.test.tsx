import React from 'react'
import { Buffer } from 'buffer'
import { render, waitFor } from '@testing-library/react'

import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'

// local
import { App } from './loaderUtil'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-ignore
global.nodeImage = Image
// @ts-ignore
global.nodeCreateCanvas = createCanvas

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }

jest.spyOn(global, 'fetch').mockImplementation(async (url: any, args: any) => {
  if (/plugin-store/.exec(`${url}`)) {
    return new Response(
      JSON.stringify({
        plugins: [
          {
            url: 'https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js',
          },
        ],
      }),
    )
  }
  if (`${url}`.includes('testid')) {
    return new Response(
      `{"session":"U2FsdGVkX1+9+Hsy+o75Cdyb1jGYB/N1/h6Jr5ARZRF02uH2AN70Uc/yTXAEo4PQMVypDZMLqO+LJcnF6k2FKfRo9w3oeL+EbWZsXgsTrP5IrE+xYN1wfdTKoIohbQMI+zcIZGLVNf7UqNZjwzsIracm5DkgZh9EWo4MAkBP10ZZEWSdV7gmg95a5ofta2bOMpL4T5yOdukBa+6Uvv9qYXt2KdZPR4PoVLQUTE67zIdc0A9n9BuXiTOFUmczfJVvkoQSOGaXGgSUVoK31Ei12lk67a55YtbG3ClENIMcSK/YbMH7w9HtqImzPY0jaQZSZ6ikKW8fXIbXmqX0oadOKS70RNVcF5JcDMYKx6zPxAf7WjpuFh+cNNr7j6bizRoTbuZi+xNsPpnA2QmbtOXCQzbOao1Oj3HzriBAIGC56bSxx0YfJ0en751LV6yrLPsnMmmmowTIjkbH5c+QRJId9sdYQb9Ytqr2dWBKixHSGhLBfdNr0yt3t5GQRu11Rlq6OekrA9KcmHv9QU3AhDtj9TYjG5vqveYCDfS7uSc3TJLEczwF8p02wjuGapYV5QpX+Lm9ADO8X+qW+bFZj3EGKoQBTUSfV1fd3t5oH3KWWuWYpMuRLbSYgcjKC29DOUJA43k+Ufmio+wO7CufcgGkIWlpejojX8f28UsPXaONmd3t8H4bmzXkB631E1EVS4y+RZGxc2uSVedS446qq/9tV9XJW9tkwNINwbpMHAG0OZk="}`,
    )
  }
  if (`${url}`.includes('testcustomcallback')) {
    return new Response(
      `{"session":"eJzVVm1v2zYQ_isCvzQB7NiK4zTQt9TNVm9p59puUmANAlo6SdwoSiPptwb-7zuSsiw7dhpk2YB9MGAe7-W5e053fCAsIgHRX5fwOfslnJAGETQDFPWFhkRSzXLhaVDagwXNCg6e37ponbZP_YbXDfyLoPvWG3xEs4zKhAkStBskknQO8pZFOiVB5-KsQWYM5ooEvz-4cGzj-974RnO9LEzUayaAyp9B5BncoBHe5HGsQA8WJDhtt9H7pBiANMf2SbuLwZgqOF1CNIQE_bkoEuJPLo1QJ5foRGkqtQUHAhF00ZPfQLUZSAUoiClX0CBUKcgmfFkaz3I-yxdkdYf4JA3_rKUwHOpr-XF0c7PBfslZIjIQWo2NMl6EuYhZMnWZVv6aPBdJUwKNVFPNmhOaNf1zv312cX7WOe-87TQVKIUGay9lhrXgf_XTL1dt6Y-Gu5XbYHjvrFBhwDhMi_U5KH2o3kD9OhmLSO362NZvkBRYkmLxfFP9nZQenjYtofejp5I_gHy7KPeFdX2_WH43zZZPFeRIHvqNpyI0YI5ioHoq4dh7-CY8TwIehFcKTxLQR28UsiiiN8ffxIoY9kUEEhvApOGQD0tRLbGdi1WDjGbJT87rHvU9l6sVGqk0n4_yWPc4KwomkqrlYsY1yHeWmJjTpC9CPo3A9qo5Xy3Ks9_tnBtPo0-DnkmdJrDLaZq__0qv2Kw72eV0j9GG2LMf8rrX_BXJVaIIS___GsO1HPbxtufWEQccQm3Gi5Fa5oh1rXI-dcXybflMaBxsJtbqBbQ-e1Y8q6I1dk-7bdd-6_xIoOUUnMx1t5Os7sygS1kEHzCeqU7ZohvRb-jBzPLqyo7FkS1RLseulCnDMDJMWUg5KVWu6QQ4loYYDJy6T6CEhUmANFmVXg2KOYuQT8tb3d24Hm7T9gc1qq_gwyGVWxvIzmqOuOwy2PA3hoV2fLusH2-uirmriNUxbQkrGL06ye6yAoAbyvx52ZZAGCwrcqlHTlp6XaPZd1eB6u-5NB1J8aObwW3FhEtVgP0W-9jvVIRQXtTBuEV1cCnafnh6aDy5DkV9N1tjzxp7c6ZTb3TjHYV5sTwm29vcgFrvc-wvGtFCbw2AdzS7LIX4xqDZdR5Ws3Aq2QG4J6hp9RV8sUqp1kXQanG05mmudNDBp0bLtMp9RDVtOSct1x4nfygMYLjD2bIwkfizo-KP_ePIhuat58UPHxOvN_T_d2u88cIV8npvpC3TR9X8L98zr_w-eGz_dHYvIsKut3KY9KpBZvr-bvU3l2iNHA"}`,
    )
  }
  if (`${url}`.includes('nonexist')) {
    return new Response('', {
      status: 404,
      statusText: 'failed to find session',
    })
  }
  // this is the analytics
  if (`${url}`.includes('jb2=true')) {
    return new Response('{}')
  }
  try {
    const file = getFile(`${url}`)
    const maxRangeRequest = 2000000 // kind of arbitrary, part of the rangeParser
    if (args?.headers && 'range' in args.headers) {
      const range = rangeParser(maxRangeRequest, args.headers.range)
      if (range === -2 || range === -1) {
        throw new Error(`Error parsing range "${args.headers.range}"`)
      }
      const { start, end } = range[0]!
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const { bytesRead } = await file.read(buf, 0, len, start)
      const stat = await file.stat()
      return new Response(buf.subarray(0, bytesRead), {
        status: 206,
        headers: [['content-range', `${start}-${end}/${stat.size}`]],
      })
    }
    return new Response(await file.readFile(), { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(undefined, { status: 404 })
  }
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('errors with config in URL that does not exist', async () => {
  console.error = jest.fn()
  const { findByText } = render(<App search="?config=doesNotExist.json" />)
  await findByText(/HTTP 404 fetching doesNotExist.json/)
})

test('can use config from a url with session param+sessionStorage', async () => {
  sessionStorage.setItem('current', `{"id": "abcdefg", "name": "testSession"}`)
  const { findByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=abcdefg" />,
  )

  await findByText('Help', {}, delay)
}, 20000)

test('can use config from a url with shared session ', async () => {
  render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=share-testid&password=Z42aq" />,
  )

  await waitFor(() => {
    expect(sessionStorage.length).toBeGreaterThan(0)
  }, delay)
}, 20000)

// minimal session with plugin in our plugins.json
test('approves sessionPlugins from plugin list', async () => {
  expect(sessionStorage.length).toBe(0)
  render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js","name":"MsaView"}]}}' />,
  )
  await waitFor(
    () => {
      expect(sessionStorage.length).toBeGreaterThan(0)
    },
    {
      timeout: 50000,
    },
  )
}, 50000)

// minimal session,
// {"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
test('pops up a warning for evil plugin in sessionPlugins', async () => {
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://evil.com/evil.js"}]}}' />,
  )
  await findByText(/Warning/, {}, delay)
}, 20000)

test('can use config from a url with nonexistent share param ', async () => {
  const { findAllByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=share-nonexist" />,
  )
  await findAllByText(/Error/, {}, delay)
}, 20000)

test('can catch error from loading a bad config', async () => {
  const { findAllByText } = render(
    <App search="?config=test_data/bad_config_test/config.json" />,
  )
  await findAllByText(/Error while converting/)
}, 20000)

test('can use a spec url for lgv', async () => {
  const { findByText, findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&loc=ctgA:6000-7000&assembly=volvox&tracks=volvox_bam_pileup" />,
  )

  await findByText(/volvox-sorted.bam/, {}, delay)
  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(() => {
    expect((elt as HTMLInputElement).value).toBe('ctgA:5,999..6,999')
  }, delay)
}, 40000)

test('can use a spec url for spreadsheet view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SpreadsheetView","uri":"test_data/volvox/volvox.filtered.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgA:8470..8471', {}, delay)
}, 40000)

test('can use a spec url for sv inspector view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SvInspectorView","uri":"test_data/volvox/volvox.dup.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgB:1982..1983', {}, delay)
}, 40000)

test('can use a spec url for dotplot view', async () => {
  const { findByTestId } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}' />,
  )

  await findByTestId('prerendered_canvas_done', {}, delay)
}, 40000)
