import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'
import config from '../../test_data/volvox/config_auth.json' with { type: 'json' }

setup()

beforeEach(() => {
  doBeforeEach()
  sessionStorage.clear()
})

const delay = { timeout: 20000 }

test('opens a bigwig track that needs httpbasic authentication', async () => {
  const { findByTestId, findAllByTestId, findByText, view } = await createView({
    ...config,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'volvox_microarray_httpbasic',
        name: 'wiggle_track xyplot httpbasic',
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
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_httpbasic'), {}, delay),
  )
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
  ).toContain(btoa('username:password'))

  const displays = await findAllByTestId(/^display-.*-done$/, {}, delay)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 25000)
