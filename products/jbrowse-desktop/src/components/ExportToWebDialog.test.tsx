import { act, fireEvent, render, waitFor } from '@testing-library/react'

import ExportToWebDialog from './ExportToWebDialog.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type * as ProductCore from '@jbrowse/product-core'
import type { WebExportInput } from '@jbrowse/product-core'

// The dialog's only read of the live session is the promotable-default bake,
// which needs a whole app to produce anything; pass the plan's session through
// so the rest of the pipeline (planning, encoding, url assembly) stays real.
jest.mock('@jbrowse/product-core', () => {
  const actual = jest.requireActual<typeof ProductCore>('@jbrowse/product-core')
  return {
    ...actual,
    bakeSessionCascades: (
      _session: unknown,
      snapshot: Record<string, unknown>,
    ) => snapshot,
  }
})

// stands in for the live session — only ever handed back to the mocked bake and
// to copyTextWithSession's notification
const session = { notify: () => {} } as unknown as AbstractSessionModel

const LOCAL_TRACK = {
  trackId: 'local',
  name: 'My local alignments',
  adapter: {
    bamLocation: {
      locationType: 'LocalPathLocation',
      localPath: '/home/me/a.bam',
    },
  },
}

const snapshot: WebExportInput = {
  assemblies: [{ name: 'hg38' }],
  tracks: [{ trackId: 'remote', name: 'Remote track' }, LOCAL_TRACK],
  defaultSession: { name: 'my session', views: [] },
}

async function renderDialog(input: WebExportInput = snapshot) {
  const utils = render(
    <ExportToWebDialog
      snapshot={input}
      session={session}
      handleClose={() => {}}
    />,
  )
  // the actions stay disabled until a link exists
  await waitFor(() => {
    expect(utils.queryByText(/Generating/)).toBeNull()
  })
  return utils
}

// MUI renders into a portal, so the link field is outside `container`
const linkValue = () =>
  document.body.querySelector<HTMLInputElement>('input[readonly]')?.value ?? ''

test('defaults to a long link that carries the session inline', async () => {
  await renderDialog()

  // 'long' is the default because it uploads nothing; 'short' would POST the
  // session to the share server merely on opening the dialog
  const url = new URL(linkValue())
  expect(url.search).toBe('')
  const params = new URLSearchParams(url.hash.slice(1))
  expect(params.get('session')).toMatch(/^encoded-/)
  // no hosted base was reachable, so the session carries its own assemblies
  expect(params.get('config')).toBe('none')
  // the link opens against `latest`, a deployment nobody pins, so it records
  // what made it — see buildWebExportUrl
  expect(params.get('exportedFrom')).toMatch(/^jbrowse-desktop@\d/)
})

test('shows what the export left behind, and keeps it across a mode switch', async () => {
  const { getByText, getByLabelText } = await renderDialog()

  getByText(/My local alignments/)
  getByText(/Self-contained session/)

  fireEvent.click(getByLabelText('Plaintext JSON'))

  // Asserted here, synchronously, rather than after the await: the point is what
  // the dialog shows WHILE it re-encodes. The plan doesn't depend on the mode,
  // so what the dialog already said about the session must not blink away and
  // come back — waiting for the new link first would pass either way.
  getByText(/Generating json URL/)
  getByText(/My local alignments/)
  getByText(/Self-contained session/)

  await waitFor(() => {
    expect(linkValue()).toContain('json-')
  })
})

test('the plaintext mode can show the session that will be opened', async () => {
  const { getByText, getByLabelText, queryByLabelText } = await renderDialog()

  // only the plaintext mode has readable JSON to show
  expect(queryByLabelText('Show readable JSON')).toBeNull()

  fireEvent.click(getByLabelText('Plaintext JSON'))
  await waitFor(() => {
    getByLabelText('Show readable JSON')
  })
  fireEvent.click(getByLabelText('Show readable JSON'))

  const json = getByText(/"my session"/)
  // the local track was dropped, so it must not be in what gets opened
  expect(json.textContent).not.toContain('/home/me/a.bam')
})

// The short link is the only thing this dialog does that leaves the computer.
// Selecting it must not be what sends the session — the upload is the button.
test('choosing the short link uploads nothing until asked', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse(JSON.stringify({ sessionId: 'abc123' }))
  const { getByLabelText, getByText } = await renderDialog()

  fireEvent.click(getByLabelText('Short link'))
  getByText(/Nothing is uploaded until you press the button/)

  // Flush every pending promise before asserting the negative. useFetch calls
  // its fetcher in a microtask, so an upload started merely by selecting the
  // mode has not reached `fetch` yet at this point — assert without this and
  // the test passes whether or not the gate exists (it did; verified by
  // removing the gate and watching it still pass).
  await act(async () => {})

  expect(fetchMock).not.toHaveBeenCalled()
  // and there is no link to open or copy in the meantime
  expect(linkValue()).toBe('')

  fireEvent.click(getByText('Upload and create short link'))
  await waitFor(() => {
    expect(linkValue()).toContain('share-abc123')
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [endpoint] = fetchMock.mock.calls[0]!
  expect(endpoint).toBe('https://share.jbrowse.org/api/v1/share')
})

// Leaving the mode withdraws the permission: the alternative is that coming
// back re-sends the session on arrival, which is the surprise being removed.
test('returning to the short link asks again rather than re-uploading', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse(JSON.stringify({ sessionId: 'abc123' }))
  const { getByLabelText, getByText } = await renderDialog()

  fireEvent.click(getByLabelText('Short link'))
  fireEvent.click(getByText('Upload and create short link'))
  await waitFor(() => {
    expect(linkValue()).toContain('share-')
  })

  fireEvent.click(getByLabelText('Long link'))
  await waitFor(() => {
    expect(linkValue()).toContain('encoded-')
  })
  fireEvent.click(getByLabelText('Short link'))
  getByText('Upload and create short link')

  // as above: the re-upload this guards against would still be in flight
  await act(async () => {})

  expect(fetchMock).toHaveBeenCalledTimes(1)
})

// A self-contained export carries its own assemblies and tracks, so it is the
// biggest kind of session there is, and the long link — the default — puts all
// of it in the url. Chrome takes 2 MB, so whoever made the link sees nothing
// wrong with one Safari will refuse.
test('an unopenable long link says so and offers the mode that fixes it', async () => {
  // incompressible, so the deflate the encoder runs can't shrink it back under
  // the ceiling; a repeated string would encode to a few hundred characters
  // mulberry32, so the filler is deterministic. A textbook LCG is not enough:
  // `seed * 1103515245` leaves float precision, its low bits degenerate, and
  // deflate shrinks 200k characters of it to 12k — back under the ceiling.
  let seed = 1
  const noise = Array.from({ length: 200_000 }, () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return String.fromCodePoint(97 + (((t ^ (t >>> 14)) >>> 0) % 26))
  }).join('')
  const { getByText, getByLabelText } = await renderDialog({
    ...snapshot,
    tracks: [{ trackId: 'big', name: 'Big track', description: noise }],
  })

  expect(linkValue().length).toBeGreaterThan(80_000)
  getByText(/Safari and iOS browsers refuse to open/)

  fireEvent.click(getByText('Use a short link'))
  // the short mode's own gate still holds: the steer selects it, it does not
  // upload the session on the user's behalf
  getByText('Upload and create short link')
  expect((getByLabelText('Short link') as HTMLInputElement).checked).toBe(true)
})

test('a config webExportUrl reroutes the export to that deployment', async () => {
  await renderDialog({
    ...snapshot,
    configuration: { webExportUrl: 'https://inst.example/jbrowse/' },
  })

  const url = new URL(linkValue())
  expect(url.origin + url.pathname).toBe('https://inst.example/jbrowse/')
})

// jbrowse-web honors an empty shareURL as "relative to the page", and the page it
// means is the deployment the link opens. Left unresolved it is desktop's own
// page — `file:///…/index.html` in a packaged build — so the POST never leaves the
// app, and the consent prompt names no host at the moment it asks to send.
test('an empty shareURL on a hosted base posts to the export target', async () => {
  fetchMock.resetMocks()
  fetchMock.mockResponse(async request =>
    request.url.endsWith('config.json')
      ? JSON.stringify({
          assemblies: [{ name: 'hg38' }],
          tracks: [],
          configuration: { shareURL: '' },
        })
      : JSON.stringify({ sessionId: 'abc123' }),
  )
  const { getByLabelText, getByText } = await renderDialog({
    ...snapshot,
    configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
  })

  fireEvent.click(getByLabelText('Short link'))
  getByText(/uploads it to jbrowse\.org/)
  fireEvent.click(getByText('Upload and create short link'))
  await waitFor(() => {
    expect(linkValue()).toContain('share-abc123')
  })
  const [endpoint] = fetchMock.mock.calls.at(-1)!
  expect(endpoint).toBe('https://jbrowse.org/code/jb2/latest/share')
})
