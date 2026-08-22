import { fireEvent, render, waitFor } from '@testing-library/react'

import ShareDialog from './ShareDialog.tsx'
import { SHARE_MODE_LOCALSTORAGE_KEY } from './buildShareUrl.ts'

import type { SessionWithShareURL } from '@jbrowse/core/util'

// the dialog's only read of the live session; the baked snapshot is irrelevant
// here, and producing a real one needs a whole app
let mockSnapshot: Record<string, unknown> = { name: 'a session' }
jest.mock('@jbrowse/product-core', () => ({
  getShareableSessionSnapshot: () => mockSnapshot,
}))

afterEach(() => {
  mockSnapshot = { name: 'a session' }
})

const session = { shareURL: 'https://share.example/' } as SessionWithShareURL

async function renderDialog(handleClose = () => {}) {
  // json mode assembles the link locally; short mode would POST to the share
  // server
  localStorage.setItem(SHARE_MODE_LOCALSTORAGE_KEY, 'json')
  window.history.replaceState(
    null,
    '',
    '/app/?config=conf.json&session=local-abc',
  )
  const utils = render(
    <ShareDialog session={session} handleClose={handleClose} />,
  )
  // the buttons are disabled until the link is assembled
  await waitFor(() => {
    expect(utils.queryByText(/Generating/)).toBeNull()
  })
  return utils
}

// MUI renders the dialog into a portal, so the close button is outside
// `container`
const closeButton = () =>
  document.body.querySelector<HTMLElement>('[data-testid=CloseIcon]')!

// The address bar is what a reload restores from, so a tab left pointing at a
// share link reloads the snapshot that link was built from — silently dropping
// everything the user did after making it. The bookmark button has to put the
// share URL there (a browser can only bookmark what is in the address bar), so
// closing has to put the page's own URL back.
test('bookmarking shows the share URL, and closing puts the page URL back', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {})
  const { getByText } = await renderDialog()

  fireEvent.click(getByText('Create browser Bookmark'))
  expect(window.location.href).toContain('json-')
  expect(window.location.href).not.toContain('session=local-abc')

  fireEvent.click(closeButton())

  expect(window.location.href).toContain('session=local-abc')
  expect(window.location.href).not.toContain('json-')
})

test('closing without bookmarking leaves the page URL alone', async () => {
  const handleClose = jest.fn()
  await renderDialog(handleClose)

  fireEvent.click(closeButton())

  expect(handleClose).toHaveBeenCalled()
  expect(window.location.href).toContain('session=local-abc')
})

// a blob-backed track is in the sender's browser only, so the link carries a
// config with nothing behind it
test('warns about tracks the recipient cannot load', async () => {
  mockSnapshot = {
    sessionTracks: [
      {
        trackId: 't1',
        name: 'my local bam',
        adapter: { bamLocation: { blobId: 'b1' } },
      },
      {
        trackId: 't2',
        name: 'a remote bam',
        adapter: { bamLocation: { uri: 'http://x/y.bam' } },
      },
    ],
  }
  const { getByText, queryByText } = await renderDialog()

  expect(getByText(/my local bam/)).toBeTruthy()
  expect(queryByText(/a remote bam/)).toBeNull()
})

test('no warning when everything is a URL', async () => {
  mockSnapshot = {
    sessionTracks: [
      {
        trackId: 't2',
        name: 'a remote bam',
        adapter: { bamLocation: { uri: 'http://x/y.bam' } },
      },
    ],
  }
  const { queryByText } = await renderDialog()

  expect(queryByText(/files from your computer/)).toBeNull()
})
