import { fireEvent, waitFor, within } from '@testing-library/react'
import { RemoteFile } from 'generic-filehandle2'

import config from '../../test_data/volvox/config_auth.json' with { type: 'json' }
import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findAnyDisplayPainted,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

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
    expect(rootModel.internetAccounts.length).toBe(6)
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
  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
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

  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 25000)

// The mixin's own rule is pinned in
// packages/product-core/src/RootModel/InternetAccounts.test.ts against stand-in
// account types. This is the same rule against the accounts that ship, because
// what the rule prevents is a real one's real probe: getPreAuthorizationInformation
// validates the token by requesting the URL with the credential attached, so an
// account matched on an attacker's URL hands it over from the main thread before
// the worker is involved at all.
test('a location naming an account cannot send its token off-origin', async () => {
  const { rootModel } = await createView({
    ...config,
    internetAccounts: [
      {
        type: 'ExternalTokenInternetAccount',
        internetAccountId: 'ExternalTokenTest',
        name: 'External token',
        description: 'External Token for testing',
        domains: ['data.mylab.org'],
      },
    ],
  })
  await waitFor(() => {
    expect(
      rootModel.internetAccounts.some(
        a => a.internetAccountId === 'ExternalTokenTest',
      ),
    ).toBe(true)
  })
  const account = rootModel.internetAccounts.find(
    a => a.internetAccountId === 'ExternalTokenTest',
  )!
  account.storeToken('SECRET-LAB-TOKEN')

  const requests: string[] = []
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const auth = new Headers(init?.headers).get('Authorization')
      if (auth) {
        requests.push(`${auth} -> ${String(input)}`)
      }
      return new Response('', { status: 200 })
    })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const evil = {
      locationType: 'UriLocation' as const,
      uri: 'https://evil.example.com/attacker.bam',
      internetAccountId: 'ExternalTokenTest',
    }
    const claimed = rootModel.findAppropriateInternetAccount(evil)
    await claimed?.getPreAuthorizationInformation(evil).catch(() => {})
    expect(requests).toEqual([])
  } finally {
    warn.mockRestore()
    spy.mockRestore()
  }
}, 25000)
