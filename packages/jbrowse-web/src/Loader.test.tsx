import React from 'react'

import '@testing-library/jest-dom/extend-expect'
import { render } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'
import ErrorBoundary, { FallbackProps } from 'react-error-boundary'
import { QueryParamProvider } from 'use-query-params'

import Loader from './Loader'

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

window.requestIdleCallback = cb => cb({ didTimeout: true })
window.cancelIdleCallback = () => {}

const getFile = (url: string) => new LocalFile(require.resolve(`../${url}`))
// fakes server responses from local file object with fetchMock
const readBuffer = async (url: string, args: RequestInit) => {
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

  it('can use config from a url', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search: '?config=test_data/volvox/config_main_thread.json',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    expect(await findByText('Help')).toBeTruthy()
  })
})
