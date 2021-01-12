import React from 'react'
import ErrorBoundary, { FallbackProps } from 'react-error-boundary'
import { render, wait } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
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
  if (url.match(/testid/)) {
    return {
      ok: true,
      async text() {
        return `{"session":"U2FsdGVkX1+9+Hsy+o75Cdyb1jGYB/N1/h6Jr5ARZRF02uH2AN70Uc/yTXAEo4PQMVypDZMLqO+LJcnF6k2FKfRo9w3oeL+EbWZsXgsTrP5IrE+xYN1wfdTKoIohbQMI+zcIZGLVNf7UqNZjwzsIracm5DkgZh9EWo4MAkBP10ZZEWSdV7gmg95a5ofta2bOMpL4T5yOdukBa+6Uvv9qYXt2KdZPR4PoVLQUTE67zIdc0A9n9BuXiTOFUmczfJVvkoQSOGaXGgSUVoK31Ei12lk67a55YtbG3ClENIMcSK/YbMH7w9HtqImzPY0jaQZSZ6ikKW8fXIbXmqX0oadOKS70RNVcF5JcDMYKx6zPxAf7WjpuFh+cNNr7j6bizRoTbuZi+xNsPpnA2QmbtOXCQzbOao1Oj3HzriBAIGC56bSxx0YfJ0en751LV6yrLPsnMmmmowTIjkbH5c+QRJId9sdYQb9Ytqr2dWBKixHSGhLBfdNr0yt3t5GQRu11Rlq6OekrA9KcmHv9QU3AhDtj9TYjG5vqveYCDfS7uSc3TJLEczwF8p02wjuGapYV5QpX+Lm9ADO8X+qW+bFZj3EGKoQBTUSfV1fd3t5oH3KWWuWYpMuRLbSYgcjKC29DOUJA43k+Ufmio+wO7CufcgGkIWlpejojX8f28UsPXaONmd3t8H4bmzXkB631E1EVS4y+RZGxc2uSVedS446qq/9tV9XJW9tkwNINwbpMHAG0OZk="}`
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

const initialTimestamp = 0

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
          <Loader initialTimestamp={initialTimestamp} />
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
        <Loader initialTimestamp={initialTimestamp} />
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
        <Loader initialTimestamp={initialTimestamp} />
      </QueryParamProvider>,
    )

    await findByText('Help')
    await wait(() => {
      expect(sessionStorage.length).toBeGreaterThan(0)
    })
  })

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
          <Loader initialTimestamp={initialTimestamp} />
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
          <Loader initialTimestamp={initialTimestamp} />
        </QueryParamProvider>
      </ErrorBoundary>,
    )
    await findAllByText(/Failed to load/)
  }, 10000)
})
