import React from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { render, waitFor } from '@testing-library/react'
import { TextEncoder, TextDecoder } from 'web-encoding'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'

import { QueryParamProvider } from 'use-query-params'

import { Loader } from '../Loader'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}

const getFile = (url: string) => {
  url = url.replace(/http:\/\/localhost\//, '')
  return new LocalFile(require.resolve(`../../${url}`))
}

const readBuffer = async (url: string, args: RequestInit) => {
  if (url.match('plugin-store')) {
    return {
      ok: true,
      async json() {
        return {
          plugins: [
            {
              url:
                'https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js',
            },
          ],
        }
      },
    }
  }
  if (url.match(/testid/)) {
    return {
      ok: true,
      async text() {
        return `{"session":"U2FsdGVkX1+9+Hsy+o75Cdyb1jGYB/N1/h6Jr5ARZRF02uH2AN70Uc/yTXAEo4PQMVypDZMLqO+LJcnF6k2FKfRo9w3oeL+EbWZsXgsTrP5IrE+xYN1wfdTKoIohbQMI+zcIZGLVNf7UqNZjwzsIracm5DkgZh9EWo4MAkBP10ZZEWSdV7gmg95a5ofta2bOMpL4T5yOdukBa+6Uvv9qYXt2KdZPR4PoVLQUTE67zIdc0A9n9BuXiTOFUmczfJVvkoQSOGaXGgSUVoK31Ei12lk67a55YtbG3ClENIMcSK/YbMH7w9HtqImzPY0jaQZSZ6ikKW8fXIbXmqX0oadOKS70RNVcF5JcDMYKx6zPxAf7WjpuFh+cNNr7j6bizRoTbuZi+xNsPpnA2QmbtOXCQzbOao1Oj3HzriBAIGC56bSxx0YfJ0en751LV6yrLPsnMmmmowTIjkbH5c+QRJId9sdYQb9Ytqr2dWBKixHSGhLBfdNr0yt3t5GQRu11Rlq6OekrA9KcmHv9QU3AhDtj9TYjG5vqveYCDfS7uSc3TJLEczwF8p02wjuGapYV5QpX+Lm9ADO8X+qW+bFZj3EGKoQBTUSfV1fd3t5oH3KWWuWYpMuRLbSYgcjKC29DOUJA43k+Ufmio+wO7CufcgGkIWlpejojX8f28UsPXaONmd3t8H4bmzXkB631E1EVS4y+RZGxc2uSVedS446qq/9tV9XJW9tkwNINwbpMHAG0OZk="}`
      },
    }
  }
  if (url.match(/testcustomcallback/)) {
    return {
      ok: true,
      async text() {
        return `{"session":"eJzVVm1v2zYQ_isCvzQB7NiK4zTQt9TNVm9p59puUmANAlo6SdwoSiPptwb-7zuSsiw7dhpk2YB9MGAe7-W5e053fCAsIgHRX5fwOfslnJAGETQDFPWFhkRSzXLhaVDagwXNCg6e37ponbZP_YbXDfyLoPvWG3xEs4zKhAkStBskknQO8pZFOiVB5-KsQWYM5ooEvz-4cGzj-974RnO9LEzUayaAyp9B5BncoBHe5HGsQA8WJDhtt9H7pBiANMf2SbuLwZgqOF1CNIQE_bkoEuJPLo1QJ5foRGkqtQUHAhF00ZPfQLUZSAUoiClX0CBUKcgmfFkaz3I-yxdkdYf4JA3_rKUwHOpr-XF0c7PBfslZIjIQWo2NMl6EuYhZMnWZVv6aPBdJUwKNVFPNmhOaNf1zv312cX7WOe-87TQVKIUGay9lhrXgf_XTL1dt6Y-Gu5XbYHjvrFBhwDhMi_U5KH2o3kD9OhmLSO362NZvkBRYkmLxfFP9nZQenjYtofejp5I_gHy7KPeFdX2_WH43zZZPFeRIHvqNpyI0YI5ioHoq4dh7-CY8TwIehFcKTxLQR28UsiiiN8ffxIoY9kUEEhvApOGQD0tRLbGdi1WDjGbJT87rHvU9l6sVGqk0n4_yWPc4KwomkqrlYsY1yHeWmJjTpC9CPo3A9qo5Xy3Ks9_tnBtPo0-DnkmdJrDLaZq__0qv2Kw72eV0j9GG2LMf8rrX_BXJVaIIS___GsO1HPbxtufWEQccQm3Gi5Fa5oh1rXI-dcXybflMaBxsJtbqBbQ-e1Y8q6I1dk-7bdd-6_xIoOUUnMx1t5Os7sygS1kEHzCeqU7ZohvRb-jBzPLqyo7FkS1RLseulCnDMDJMWUg5KVWu6QQ4loYYDJy6T6CEhUmANFmVXg2KOYuQT8tb3d24Hm7T9gc1qq_gwyGVWxvIzmqOuOwy2PA3hoV2fLusH2-uirmriNUxbQkrGL06ye6yAoAbyvx52ZZAGCwrcqlHTlp6XaPZd1eB6u-5NB1J8aObwW3FhEtVgP0W-9jvVIRQXtTBuEV1cCnafnh6aDy5DkV9N1tjzxp7c6ZTb3TjHYV5sTwm29vcgFrvc-wvGtFCbw2AdzS7LIX4xqDZdR5Ws3Aq2QG4J6hp9RV8sUqp1kXQanG05mmudNDBp0bLtMp9RDVtOSct1x4nfygMYLjD2bIwkfizo-KP_ePIhuat58UPHxOvN_T_d2u88cIV8npvpC3TR9X8L98zr_w-eGz_dHYvIsKut3KY9KpBZvr-bvU3l2iNHA"}`
      },
    }
  }
  if (url.match(/nonexist/)) {
    return {
      ok: false,
      statusText: 'failed to find session',
    }
  }
  // this is the analytics
  if (url.match(/jb2=true/)) {
    return {
      ok: true,
      async json() {
        return {}
      },
    }
  }
  try {
    const file = getFile(url)
    const maxRangeRequest = 1000000 // kind of arbitrary, part of the rangeParser
    if (args.headers && 'range' in args.headers) {
      const range = rangeParser(maxRangeRequest, args.headers.range)
      if (range === -2 || range === -1) {
        throw new Error(`Error parsing range "${args.headers.range}"`)
      }
      const { start, end } = range[0]
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const { bytesRead } = await file.read(buf, 0, len, start)
      const stat = await file.stat()
      return new Response(buf.slice(0, bytesRead), {
        status: 206,
        headers: [['content-range', `${start}-${end}/${stat.size}`]],
      })
    }
    const body = await file.readFile()
    return new Response(body, { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(undefined, { status: 404 })
  }
}

// @ts-ignore
jest.spyOn(global as Global, 'fetch').mockImplementation(readBuffer)

function FallbackComponent({ error }: FallbackProps) {
  return <div>there was an error: {String(error)}</div>
}

describe('<Loader />', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  it('errors with config in URL that does not exist', async () => {
    console.error = jest.fn()
    const { findByText } = render(
      <ErrorBoundary FallbackComponent={FallbackComponent}>
        {/* @ts-ignore */}
        <QueryParamProvider location={{ search: '?config=doesNotExist.json' }}>
          <Loader />
        </QueryParamProvider>
      </ErrorBoundary>,
    )
    expect(
      await findByText('HTTP 404 fetching doesNotExist.json', {
        exact: false,
      }),
    ).toBeTruthy()
  })

  it('can use config from a url with session param+sessionStorage', async () => {
    sessionStorage.setItem(
      'current',
      `{"id": "abcdefg", "name": "testSession"}`,
    )
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=abcdefg',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )

    await findByText('Help')
  })

  it('can use config from a url with shared session ', async () => {
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=share-testid&password=Z42aq',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )

    await findByText('Help')
    await waitFor(() => {
      expect(sessionStorage.length).toBeGreaterThan(0)
    })
  })

  // minimal session with plugin in our plugins.json
  // {"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
  it('can warn of  callbacks in json session', async () => {
    render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    await waitFor(() => {
      expect(sessionStorage.length).toBeGreaterThan(0)
    })
  }, 10000)

  // minimal session,
  // {"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
  it('pops up a warning for evil plugin', async () => {
    const { findByTestId } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://evil.com/evil.js"}]}}',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    await findByTestId('session-warning-modal')
  }, 10000)

  it('can use config from a url with nonexistent share param ', async () => {
    const { findAllByText } = render(
      <ErrorBoundary FallbackComponent={({ error }) => <div>{`${error}`}</div>}>
        <QueryParamProvider
          // @ts-ignore
          location={{
            search:
              '?config=test_data/volvox/config_main_thread.json&session=share-nonexist',
          }}
        >
          <Loader />
        </QueryParamProvider>
      </ErrorBoundary>,
    )
    await findAllByText(/Error/)
  }, 10000)

  it('can catch error from loading a bad config', async () => {
    const { findAllByText } = render(
      <ErrorBoundary FallbackComponent={({ error }) => <div>{`${error}`}</div>}>
        <QueryParamProvider
          // @ts-ignore
          location={{
            search:
              '?config=test_data/bad_config_for_testing_error_catcher.json',
          }}
        >
          <Loader />
        </QueryParamProvider>
      </ErrorBoundary>,
    )
    await findAllByText(/Failed to load/)
  }, 10000)
})
