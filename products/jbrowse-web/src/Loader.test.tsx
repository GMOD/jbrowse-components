import React from 'react'

import '@testing-library/jest-dom/extend-expect'
import { render, findByTestId } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'
import ErrorBoundary, { FallbackProps } from 'react-error-boundary'
import { QueryParamProvider } from 'use-query-params'

import { Loader } from './Loader'

const BroadcastChannelMock = jest.fn()
if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder
if (!window.BroadcastChannel) window.BroadcastChannel = BroadcastChannelMock

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

  // TODO SESSION this one infinite loops
  xit('can use config from a url with no session param local uuid', async () => {
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

  // need tests for local host stuff
  xit('can use config from a url with share session param ', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()

    jest
      // @ts-ignore
      .spyOn(global as Global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              session:
                '0ade8afd4be19961053b49a166ed849aa659149c2e291bd86c926c00d0aae5fd506866bd083a3a767fbe5d1a5604c9d9fec62156d891bf45bbb5b8314544b3f4b52a630af77e22dd998dd4a8dd4354f3bc0c7017233969766f82f1bd1f862ae70a09bca8bc6c358e450842a0bb3c471f9641841a575e9643e5eaae9e9b7ba31df35677372ee5d1bd084d55402c0a7adb2f46a4280234015210128ffef67457ab',
            }),
        }),
      )
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=share-test&password=384ddcb2950f2a2c699cd9d8bc90a9f3',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    expect(await findByText('integration test session')).toBeTruthy()
  })

  xit('can use config from a url with nonexistent share param ', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()
    jest
      // @ts-ignore
      .spyOn(global as Global, 'fetch')
      .mockImplementationOnce(() => Promise.reject(new Error('error')))
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=share-nonexist',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    expect(
      await findByText('Failed to find given session in database'),
    ).toBeTruthy()
  })

  // session: { name: 'testSession' }
  xit('can use localstorage to load local session ', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()

    localStorage.setItem('localSaved-1', `session: { name: 'testSession' }`)
    expect(localStorage.length).toBe(1)
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=localSaved-1',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    expect(await findByText('testSession')).toBeTruthy()
  })
})
