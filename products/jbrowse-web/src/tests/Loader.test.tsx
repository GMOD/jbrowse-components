// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import React from 'react'
import { render, waitFor } from '@testing-library/react'

// local
import { readBuffer, App } from './loaderUtil'
import { expectCanvasMatch } from './util'

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }

// @ts-ignore
jest.spyOn(global, 'fetch').mockImplementation(readBuffer)

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('errors with config in URL that does not exist', async () => {
  console.error = jest.fn()
  const { findByText } = render(<App search="?config=doesNotExist.json" />)
  await findByText(/HTTP 404 fetching doesNotExist.json/)
})

test('can use config from a url with session param+sessionStorage', async () => {
  sessionStorage.setItem('current', `{"id": "abcdefg", "name": "testSession"}`)
  const { findByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=abcdefg" />,
  )

  await findByText('Help', {}, delay)
}, 20000)

test('can use config from a url with shared session ', async () => {
  render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=share-testid&password=Z42aq" />,
  )

  await waitFor(() => expect(sessionStorage.length).toBeGreaterThan(0), delay)
}, 20000)

// minimal session with plugin in our plugins.json
test('approves sessionPlugins from plugin list', async () => {
  expect(sessionStorage.length).toBe(0)
  render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js","name":"MsaView"}]}}' />,
  )
  await waitFor(() => expect(sessionStorage.length).toBeGreaterThan(0), {
    timeout: 50000,
  })
}, 50000)

// minimal session,
// {"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"}]}}
test('pops up a warning for evil plugin in sessionPlugins', async () => {
  const { findByTestId } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=json-{"session":{"id":"xSHu7qGJN","name":"test","sessionPlugins":[{"url":"https://evil.com/evil.js"}]}}' />,
  )
  await findByTestId('session-warning-modal')
}, 20000)

test('can use config from a url with nonexistent share param ', async () => {
  const { findAllByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&session=share-nonexist" />,
  )
  await findAllByText(/Error/, {}, delay)
}, 20000)

test('can catch error from loading a bad config', async () => {
  const { findAllByText } = render(
    <App search="?config=test_data/bad_config_for_testing_error_catcher.json" />,
  )
  await findAllByText(/Failed to load/)
}, 20000)

test('can use a spec url for lgv', async () => {
  const { findByText, findByPlaceholderText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json&loc=ctgA:6000-7000&assembly=volvox&tracks=volvox_bam_pileup" />,
  )

  await findByText(/volvox-sorted.bam/, {}, delay)
  const elt = await findByPlaceholderText('Search for location', {}, delay)
  await waitFor(
    () => expect((elt as HTMLInputElement).value).toBe('ctgA:5,999..6,999'),
    delay,
  )
}, 40000)

test('can use a spec url for spreadsheet view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SpreadsheetView","uri":"test_data/volvox/volvox.filtered.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgA:8470..8471', {}, delay)
}, 40000)

test('can use a spec url for sv inspector view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SvInspectorView","uri":"test_data/volvox/volvox.dup.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgB:1982..1983', {}, delay)
}, 40000)

test('can use a spec url for dotplot view', async () => {
  const { findByTestId } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}' />,
  )

  await findByTestId('prerendered_canvas_done', {}, delay)
}, 40000)

const r = {
  views: [
    {
      type: 'LinearSyntenyView',
      tracks: ['subset'],
      views: [
        { loc: 'Pp01:28,845,211..28,845,272[rev]', assembly: 'peach' },
        { loc: 'chr1:316,306..316,364', assembly: 'grape' },
      ],
    },
  ],
}

// test('test horizontally flipped inverted alignment', async () => {
//   console.warn = jest.fn()
//   const q = JSON.stringify(r)
//   const { findByTestId } = render(
//     <App
//       search={`?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${q}`}
//     />,
//   )
//
//   expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
// }, 40000)
