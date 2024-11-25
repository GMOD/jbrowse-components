import { fireEvent, waitFor, within } from '@testing-library/react'
import { RemoteFile } from 'generic-filehandle'
import {
  setup,
  pv,
  hts,
  createView,
  expectCanvasMatch,
  doBeforeEach,
} from './util'
import config from '../../test_data/volvox/config_auth.json'

setup()

beforeEach(() => {
  doBeforeEach()
  sessionStorage.clear()
})

const delay = { timeout: 20000 }

test('open a bigwig track that needs oauth authentication and has existing token', async () => {
  const { rootModel, view, findByTestId } = await createView({
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
  const token = '1234'
  sessionStorage.setItem('dropboxOAuth-token', token)
  await waitFor(() => {
    expect(rootModel.internetAccounts.length).toBe(4)
  })
  rootModel.internetAccounts[0]!.validateToken = jest
    .fn()
    .mockReturnValue(token)
  rootModel.internetAccounts[0]!.openLocation = jest
    .fn()
    .mockReturnValue(new RemoteFile('volvox_microarray_dropbox.bw'))
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_dropbox'), {}, delay),
  )
  expectCanvasMatch(await findByTestId(pv('1..4000-0'), {}, delay))
}, 25000)

test('opens a bigwig track that needs external token authentication', async () => {
  const { view, findByTestId } = await createView({
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
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_externaltoken'), {}, delay),
  )
  const f0 = within(await findByTestId('externalToken-form', {}, delay))
  fireEvent.change(await findByTestId('entry-externalToken'), {
    target: { value: 'testentry' },
  })
  fireEvent.click(await f0.findByText('Add'))

  expect(Object.keys(sessionStorage)).toContain('ExternalTokenTest-token')
  expect(Object.values(sessionStorage)).toContain('testentry')

  expectCanvasMatch(await findByTestId(pv('1..4000-0'), {}, delay))
}, 25000)
