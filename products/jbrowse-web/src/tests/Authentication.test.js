import React from 'react'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { LocalFile, RemoteFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import crypto from 'crypto'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import config from '../../test_data/volvox/config.json'
import {
  JBrowse,
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  getPluginManager,
} from './util'

expect.extend({ toMatchImageSnapshot })
setup()

global.crypto = { getRandomValues: crypto.randomFillSync }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  sessionStorage.clear()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

const delay = { timeout: 20000 }

test('open a bigwig track that needs oauth authentication and has existing token', async () => {
  const pm = getPluginManager({
    ...config,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'volvox_microarray_dropbox',
        name: 'wiggle_track xyplot dropbox',
        category: ['Integration test'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'volvox_microarray.bw',
            locationType: 'UriLocation',
            internetAccountId: 'dropboxOAuth',
          },
        },
      },
    ],
  })
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  const token = '1234'
  sessionStorage.setItem('dropboxOAuth-token', token)
  await waitFor(() => expect(state.internetAccounts.length).toBe(2))
  state.internetAccounts[0].validateToken = jest.fn().mockReturnValue(token)
  state.internetAccounts[0].openLocation = jest
    .fn()
    .mockReturnValue(new RemoteFile('volvox_microarray_dropbox.bw'))
  await findByText('Help')
  state.session.views[0].setNewView(5, 0)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray_dropbox',{},{timeout:10000}))
  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{volvox}ctgA:1..4,000-0', {}, delay),
  )
}, 25000)

test('opens a bigwig track that needs external token authentication', async () => {
  const pm = getPluginManager({
    ...config,
    internetAccounts: [
      {
        type: 'ExternalTokenInternetAccount',
        internetAccountId: 'ExternalTokenTest',
        name: 'External token',
        description: 'External Token for testing',
        domains: [],
      },
    ],
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'volvox_microarray_externaltoken',
        name: 'wiggle_track xyplot external token',
        category: ['Integration test'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'volvox_microarray.bw',
            locationType: 'UriLocation',
            internetAccountId: 'ExternalTokenTest',
          },
        },
      },
    ],
  })
  const state = pm.rootModel
  const { findByTestId } = render(<JBrowse pluginManager={pm} />)
  state.session.views[0].setNewView(5, 0)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_microarray_externaltoken',{},{timeout:10000}),
  )
  const { findByText: findByTextWithin } = within(
    await findByTestId('externalToken-form', {}, delay),
  )
  fireEvent.change(await findByTestId('entry-externalToken'), {
    target: { value: 'testentry' },
  })
  fireEvent.click(await findByTextWithin('Add'))

  expect(Object.keys(sessionStorage)).toContain('ExternalTokenTest-token')
  expect(Object.values(sessionStorage)).toContain('testentry')

  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{volvox}ctgA:1..4,000-0', {}, delay),
  )
}, 25000)

test('opens a bigwig track that needs httpbasic authentication', async () => {
  const pm = getPluginManager({
    ...config,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'volvox_microarray_httpbasic',
        name: 'wiggle_track xyplot httpbasic',
        category: ['Integration test'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'volvox_microarray.bw',
            locationType: 'UriLocation',
            internetAccountId: 'HTTPBasicInternetAccount-HTTPBasicTest',
          },
        },
      },
    ],
  })
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  state.session.views[0].setNewView(5, 0)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_microarray_httpbasic',{},{timeout:10000}),
  )
  await findByTestId('login-httpbasic')
  fireEvent.change(await findByTestId('login-httpbasic-username'), {
    target: { value: 'username' },
  })
  fireEvent.change(await findByTestId('login-httpbasic-password'), {
    target: { value: 'password' },
  })
  fireEvent.click(await findByText('Submit'))

  expect(Object.keys(sessionStorage)).toContain(
    'HTTPBasicInternetAccount-HTTPBasicTest-token',
  )
  expect(
    sessionStorage.getItem('HTTPBasicInternetAccount-HTTPBasicTest-token'),
  ).toContain(btoa(`username:password`))

  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{volvox}ctgA:1..4,000-0', {}, delay),
  )
})
