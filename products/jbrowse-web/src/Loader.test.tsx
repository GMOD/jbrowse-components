import React from 'react'

import '@testing-library/jest-dom/extend-expect'
import { render } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'
import ErrorBoundary, { FallbackProps } from 'react-error-boundary'
import { QueryParamProvider } from 'use-query-params'

import { Loader } from './Loader'

class BroadcastChannelMock {
  postMessage() {
    jest.fn()
  }

  onmessage() {
    jest.fn()
  }

  get name() {
    return ''
  }

  onmessageerror() {
    jest.fn()
  }

  close() {
    jest.fn()
  }

  addEventListener() {
    jest.fn()
  }

  removeEventListener() {
    jest.fn()
  }

  dispatchEvent() {
    jest.fn()
    return false
  }
}

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder
if (!window.BroadcastChannel) window.BroadcastChannel = BroadcastChannelMock

window.requestIdleCallback = (
  cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
) => {
  cb({ didTimeout: true, timeRemaining: () => 0 })
  return 1
}
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

  it('can use config from a url with no session param local uuid', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()
    Storage.prototype.getItem = jest.fn(() => `{"name": "testSession"}`)
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config_main_thread.json&session=local-1',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )

    expect(await findByText('Help')).toBeTruthy()
  })

  // FUTURE TODO: the setQueryParam hook for QueryParamProvider does not seem to have
  // a good way to be mocked, can only test loading where the session param does not have
  // to be set. Below work once there is a good solution to mocking setSessionParam
  xit('can use config from a url with share session param ', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session:
          '62fbd7cfbbd56f5d6a6fcf118a954a42706fce7cd91b344cd22687ece0ffd4ff38ea78e6c01f85c487904a861943c30dbe6547437448f887dcea94f5b5e79e3342f28e173a19faf615016235bce6d001082836626d6dc5a18a7c494ca66d612f1c59441de2bcab86785afab450f03f79ac54c6f9fd69d1a1074d690f94c0c3f80aaf41f75bc84f8bca23e509ba083bb6b44d463cc2ce923f644cd39d343bbbbf2eb63108917d17ad474c6526acf7dc2634d27e10da283b2c0e5dfe0e408026d7d9ece64f1e61b2507df3ce78279985e70ee11068882225e2f41e2a376d185a6a192024bfa2a6a6456ceea99a654d27201fa7f2e379f4a99ca029613a82850349bde2e0edf947077889e37ae1912d2586a95bea6c268983c9d3b8da2ba03880804defc312af1b7c60109cda78c0453780f13258344d54df4578972966d415fb425fd943193e1665713d93fec066589ce0ae401581a54d33783503bd04cf7cf1610e5cea2354434878e69d9cad137bd2c97462f9cbbd8e7fd2daa9a05b35922bf8314296b3a0262c9c82a36c9858d24a7bd099416e5fcdac21a08fb302e158f7063a5f81aab9d5026f1ed76699c0a79a1f33fd44fb8e9849b0661d6306bc85ea0326062e24b473b6f91aa473fa97e43ed701092143fd3eb4208c97fef9c91fb6da6c70f3995df87ef93db05a958e73c60d2201ada77d110a3c6e8df1c856c29e37',
      }),
    })
    const { findByText } = render(
      <QueryParamProvider
        // @ts-ignore
        location={{
          search:
            '?config=test_data/volvox/config.json&session=share-test&password=17732efacf3f4909151acb11e1d5f057',
        }}
      >
        <Loader />
      </QueryParamProvider>,
    )
    expect(await findByText('Help')).toBeTruthy()
    expect(sessionStorage.length).toBeGreaterThan(0)
  })

  xit('can use config from a url with nonexistent share param ', async () => {
    console.error = jest.fn()
    // onaction warning from linear-comparative-view
    console.warn = jest.fn()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce({
      ok: false,
    })
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
})
