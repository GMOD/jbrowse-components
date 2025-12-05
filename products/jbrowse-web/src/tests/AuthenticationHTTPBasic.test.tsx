import userEvent from '@testing-library/user-event'

import { createView, expectCanvasMatch, hts, pv, setupTest } from './util'
import config from '../../test_data/volvox/config_auth.json'

setupTest(undefined, { clearStorageAfterEach: true })

beforeEach(() => {
  sessionStorage.clear()
})

const delay = { timeout: 20000 }

test('opens a bigwig track that needs httpbasic authentication', async () => {
  const user = userEvent.setup()
  const { findByTestId, findByText, view } = await createView({
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
  await user.click(
    await findByTestId(hts('volvox_microarray_httpbasic'), {}, delay),
  )
  await user.clear(await findByTestId('login-httpbasic-username'))
  await user.type(await findByTestId('login-httpbasic-username'), 'username')
  await user.clear(await findByTestId('login-httpbasic-password'))
  await user.type(await findByTestId('login-httpbasic-password'), 'password')
  await user.click(await findByText('Submit'))

  expect(Object.keys(sessionStorage)).toContain(
    'HTTPBasicInternetAccount-HTTPBasicTest-token',
  )
  expect(
    sessionStorage.getItem('HTTPBasicInternetAccount-HTTPBasicTest-token'),
  ).toContain(btoa('username:password'))

  expectCanvasMatch(await findByTestId(pv('1..4000-0'), {}, delay))
}, 25000)
