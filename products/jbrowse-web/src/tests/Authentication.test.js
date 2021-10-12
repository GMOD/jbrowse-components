// library
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import React from 'react'
import { LocalFile, RemoteFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import config from '../../test_data/volvox/config.json'
import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'

expect.extend({ toMatchImageSnapshot })
setup()
afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  sessionStorage.clear()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

describe('authentication', () => {
  it('open a bigwig track that needs oauth authentication and has existing token', async () => {
    const pluginManager = getPluginManager({
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
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    sessionStorage.setItem('dropboxOAuth-token', '1234')
    state.internetAccounts[0].fetchFile = jest
      .fn()
      .mockReturnValue('volvox_microarray_dropbox.bw')
    state.internetAccounts[0].openLocation = jest
      .fn()
      .mockReturnValue(new RemoteFile('volvox_microarray_dropbox.bw'))
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_dropbox'),
    )
    const canvas = await findAllByTestId(
      'prerendered_canvas',
      {},
      {
        timeout: 20000,
      },
    )
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 25000)

  it('opens a bigwig track that needs external token authentication', async () => {
    const pluginManager = getPluginManager({
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
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_externaltoken'),
    )
    const { findByText: findByTextWithin } = within(
      await findByTestId('externalToken-form'),
    )
    fireEvent.change(await findByTestId('entry-externalToken'), {
      target: { value: 'testentry' },
    })
    fireEvent.click(await findByTextWithin('Add'))

    expect(Object.keys(sessionStorage)).toContain('ExternalTokenTest-token')
    expect(Object.values(sessionStorage)).toContain('testentry')

    const canvas = await findAllByTestId(
      'prerendered_canvas',
      {},
      {
        timeout: 20000,
      },
    )
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 25000)

  it('opens a bigwig track that needs httpbasic authentication', async () => {
    const pluginManager = getPluginManager({
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
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    // state.internetAccounts[1].fetchFile = jest
    //   .fn()
    //   .mockReturnValue('volvox_microarray_dropbox.bw')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_httpbasic'),
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

    const canvas = await findAllByTestId(
      'prerendered_canvas',
      {},
      {
        timeout: 20000,
      },
    )
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
}, 25000)
