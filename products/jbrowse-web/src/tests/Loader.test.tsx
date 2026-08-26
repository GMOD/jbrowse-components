import { render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'
import { suppressTeardownNoise } from './teardownNoise.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

const delay = { timeout: 20000 }

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  if (`${url}`.includes('plugin-store')) {
    return new Response(
      JSON.stringify({
        plugins: [
          {
            url: 'https://jbrowse.org/plugins/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js',
          },
        ],
      }),
    )
  } else if (`${url}`.includes('testid')) {
    return new Response(
      `{"session":"U2FsdGVkX1+9+Hsy+o75Cdyb1jGYB/N1/h6Jr5ARZRF02uH2AN70Uc/yTXAEo4PQMVypDZMLqO+LJcnF6k2FKfRo9w3oeL+EbWZsXgsTrP5IrE+xYN1wfdTKoIohbQMI+zcIZGLVNf7UqNZjwzsIracm5DkgZh9EWo4MAkBP10ZZEWSdV7gmg95a5ofta2bOMpL4T5yOdukBa+6Uvv9qYXt2KdZPR4PoVLQUTE67zIdc0A9n9BuXiTOFUmczfJVvkoQSOGaXGgSUVoK31Ei12lk67a55YtbG3ClENIMcSK/YbMH7w9HtqImzPY0jaQZSZ6ikKW8fXIbXmqX0oadOKS70RNVcF5JcDMYKx6zPxAf7WjpuFh+cNNr7j6bizRoTbuZi+xNsPpnA2QmbtOXCQzbOao1Oj3HzriBAIGC56bSxx0YfJ0en751LV6yrLPsnMmmmowTIjkbH5c+QRJId9sdYQb9Ytqr2dWBKixHSGhLBfdNr0yt3t5GQRu11Rlq6OekrA9KcmHv9QU3AhDtj9TYjG5vqveYCDfS7uSc3TJLEczwF8p02wjuGapYV5QpX+Lm9ADO8X+qW+bFZj3EGKoQBTUSfV1fd3t5oH3KWWuWYpMuRLbSYgcjKC29DOUJA43k+Ufmio+wO7CufcgGkIWlpejojX8f28UsPXaONmd3t8H4bmzXkB631E1EVS4y+RZGxc2uSVedS446qq/9tV9XJW9tkwNINwbpMHAG0OZk="}`,
    )
  } else if (`${url}`.includes('testcustomcallback')) {
    return new Response(
      `{"session":"eJzVVm1v2zYQ_isCvzQB7NiK4zTQt9TNVm9p59puUmANAlo6SdwoSiPptwb-7zuSsiw7dhpk2YB9MGAe7-W5e053fCAsIgHRX5fwOfslnJAGETQDFPWFhkRSzXLhaVDagwXNCg6e37ponbZP_YbXDfyLoPvWG3xEs4zKhAkStBskknQO8pZFOiVB5-KsQWYM5ooEvz-4cGzj-974RnO9LEzUayaAyp9B5BncoBHe5HGsQA8WJDhtt9H7pBiANMf2SbuLwZgqOF1CNIQE_bkoEuJPLo1QJ5foRGkqtQUHAhF00ZPfQLUZSAUoiClX0CBUKcgmfFkaz3I-yxdkdYf4JA3_rKUwHOpr-XF0c7PBfslZIjIQWo2NMl6EuYhZMnWZVv6aPBdJUwKNVFPNmhOaNf1zv312cX7WOe-87TQVKIUGay9lhrXgf_XTL1dt6Y-Gu5XbYHjvrFBhwDhMi_U5KH2o3kD9OhmLSO362NZvkBRYkmLxfFP9nZQenjYtofejp5I_gHy7KPeFdX2_WH43zZZPFeRIHvqNpyI0YI5ioHoq4dh7-CY8TwIehFcKTxLQR28UsiiiN8ffxIoY9kUEEhvApOGQD0tRLbGdi1WDjGbJT87rHvU9l6sVGqk0n4_yWPc4KwomkqrlYsY1yHeWmJjTpC9CPo3A9qo5Xy3Ks9_tnBtPo0-DnkmdJrDLaZq__0qv2Kw72eV0j9GG2LMf8rrX_BXJVaIIS___GsO1HPbxtufWEQccQm3Gi5Fa5oh1rXI-dcXybflMaBxsJtbqBbQ-e1Y8q6I1dk-7bdd-6_xIoOUUnMx1t5Os7sygS1kEHzCeqU7ZohvRb-jBzPLqyo7FkS1RLseulCnDMDJMWUg5KVWu6QQ4loYYDJy6T6CEhUmANFmVXg2KOYuQT8tb3d24Hm7T9gc1qq_gwyGVWxvIzmqOuOwy2PA3hoV2fLusH2-uirmriNUxbQkrGL06ye6yAoAbyvx52ZZAGCwrcqlHTlp6XaPZd1eB6u-5NB1J8aObwW3FhEtVgP0W-9jvVIRQXtTBuEV1cCnafnh6aDy5DkV9N1tjzxp7c6ZTb3TjHYV5sTwm29vcgFrvc-wvGtFCbw2AdzS7LIX4xqDZdR5Ws3Aq2QG4J6hp9RV8sUqp1kXQanG05mmudNDBp0bLtMp9RDVtOSct1x4nfygMYLjD2bIwkfizo-KP_ePIhuat58UPHxOvN_T_d2u88cIV8npvpC3TR9X8L98zr_w-eGz_dHYvIsKut3KY9KpBZvr-bvU3l2iNHA"}`,
    )
  } else if (`${url}`.includes('nonexist')) {
    return new Response('', {
      status: 404,
      statusText: 'failed to find session',
    })
  } else if (`${url}`.includes('jb2=true')) {
    return new Response('{}')
  } else {
    return handleRequest(() => getFile(`${url}`), args)
  }
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// each test here stands up a whole app and lets the previous one's tree go, so
// the deferred destroy lands mid-test; see the helper for why that half is
// collected rather than printed
suppressTeardownNoise()

test('errors with config in URL that does not exist', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const { findByText } = render(<App search="?config=doesNotExist.json" />)
  await findByText(/HTTP 404 fetching doesNotExist.json/)
})

test('can use config from a url with session param+sessionStorage', async () => {
  // the URL's `session=abcdefg` names no known format on purpose — the loader
  // reports that and falls back to what sessionStorage holds
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  sessionStorage.setItem('current', `{"id": "abcdefg", "name": "testSession"}`)
  const { findByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=abcdefg" />,
  )

  await findByText('Help', {}, delay)
  expect(error.mock.calls.flat().join(' ')).toContain(
    'Unrecognized URL session format',
  )
  error.mockRestore()
}, 20000)

// The boot half of the crash-recovery ladder, through the real Renderer: a
// marker naming the session the URL asks for holds it at the offer instead of
// restoring it, which is what stops FatalErrorDialog's Refresh re-entering the
// crash.
test('a crash marker offers the session rather than restoring it', async () => {
  sessionStorage.setItem(
    'current',
    `{"session":{"id": "abcdefg", "name": "testSession"}}`,
  )
  sessionStorage.setItem(
    'crashedSession',
    JSON.stringify({ id: 'abcdefg', message: 'Error: boom', at: 'now' }),
  )
  const { findByText, findByTestId } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=local-abcdefg" />,
  )

  await findByText(/JBrowse stopped unexpectedly/, {}, delay)
  await findByTestId('open_crashed_session')
  await findByTestId('start_fresh_session')
}, 20000)

// The other side of it, and the reason the clear exists at all: a marker left
// by a crash in a DIFFERENT session must not haunt this one. Cleared from
// JBrowse.tsx's mount effect, i.e. once the whole app tree has committed.
test('a healthy boot clears a marker left by an earlier crash', async () => {
  sessionStorage.setItem(
    'current',
    `{"session":{"id": "abcdefg", "name": "testSession"}}`,
  )
  sessionStorage.setItem(
    'crashedSession',
    JSON.stringify({ id: 'someOtherSession', message: 'Error: boom' }),
  )
  const { findByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=local-abcdefg" />,
  )

  await findByText('Help', {}, delay)
  expect(sessionStorage.getItem('crashedSession')).toBeNull()
}, 20000)

test('can use config from a url with shared session ', async () => {
  render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=share-testid&password=Z42aq" />,
  )

  await waitFor(() => {
    expect(sessionStorage.length).toBeGreaterThan(0)
  }, delay)
}, 20000)

// minimal session with plugin in our plugins.json
//
// Asserts the absence of the triage dialog its evil-plugin sibling below
// asserts the presence of, which is what "approves" means here.
//
// It used to wait for sessionStorage to be written instead, and that was a
// false green: this session never gets far enough to write anything, because
// approving the plugin goes on to import it from jbrowse.org and jsdom does
// not fetch that, so the load parks there. The wait passed on the PREVIOUS
// test's rootModel, which was still alive with its autosave autorun attached —
// disposeLoader was mocked to a no-op for every suite in this directory — and
// wrote sessionStorage from under it after afterEach had cleared it. Run this
// test on its own and it failed even then. With the real teardown the zombie
// is gone, and so is the false green.
test('approves sessionPlugins from plugin list', async () => {
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://jbrowse.org/plugins/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js","name":"MsaView"}]}}' />,
  )
  await expect(findByText(/Warning/, {}, { timeout: 2000 })).rejects.toThrow()
}, 20000)

// minimal session,
// {"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
test('pops up a warning for evil plugin in sessionPlugins', async () => {
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://evil.com/evil.js"}]}}' />,
  )
  await findByText(/Warning/, {}, delay)
}, 20000)

test('can use config from a url with nonexistent share param ', async () => {
  // no `password`, so the share cannot be decrypted — the reason is reported
  // and the app shows the error this asserts
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { findAllByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=share-nonexist" />,
  )
  await findAllByText(/Error/, {}, delay)
  expect(error.mock.calls.flat().join(' ')).toContain('missing its "password"')
  error.mockRestore()
}, 20000)
