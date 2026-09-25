import { fireEvent, render, waitFor } from '@testing-library/react'

import ShareDialog, { SHARE_MODE_LOCALSTORAGE_KEY } from './ShareDialog.tsx'
import { buildShareUrl } from './buildShareUrl.ts'

import type { SessionWithShareURL } from '@jbrowse/core/util'

// the dialog's only read of the live session; the baked snapshot is irrelevant
// here, and producing a real one needs a whole app
let mockSnapshot: Record<string, unknown> = { name: 'a session' }
jest.mock('@jbrowse/product-core', () => ({
  getShareableSessionSnapshot: () => mockSnapshot,
}))

// short mode would POST to the share server; the link's shape is
// buildShareUrl.test.ts's business
jest.mock('./buildShareUrl.ts', () => ({
  buildShareUrl: jest.fn(
    async (mode: string) => `http://localhost/app/#session=${mode}-link`,
  ),
}))

const mockBuild = buildShareUrl as jest.Mock

afterEach(() => {
  mockSnapshot = { name: 'a session' }
  mockBuild.mockClear()
})

const session = {
  shareURL: 'https://share.example/',
  notify: () => {},
  notifyError: () => {},
} as unknown as SessionWithShareURL

async function renderDialog(mode = 'long', handleClose = () => {}) {
  localStorage.setItem(SHARE_MODE_LOCALSTORAGE_KEY, mode)
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

async function pickMode(
  utils: Awaited<ReturnType<typeof renderDialog>>,
  label: string,
) {
  fireEvent.click(utils.getByLabelText('Session sharing settings'))
  fireEvent.click(await utils.findByText(label))
  await waitFor(() => {
    expect(utils.queryByText(/Generating/)).toBeNull()
  })
}

// The address bar is what a reload restores from, so a tab left pointing at a
// share link reloads the snapshot that link was built from — silently dropping
// everything the user did after making it. The bookmark button has to put the
// share URL there (a browser can only bookmark what is in the address bar), so
// closing has to put the page's own URL back.
test('bookmarking shows the share URL, and closing puts the page URL back', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {})
  const { getByText } = await renderDialog()

  fireEvent.click(getByText('Create browser Bookmark'))
  expect(window.location.href).toContain('long-link')
  expect(window.location.href).not.toContain('session=local-abc')

  fireEvent.click(closeButton())

  expect(window.location.href).toContain('session=local-abc')
  expect(window.location.href).not.toContain('long-link')
})

test('closing without bookmarking leaves the page URL alone', async () => {
  const handleClose = jest.fn()
  await renderDialog('long', handleClose)

  fireEvent.click(closeButton())

  expect(handleClose).toHaveBeenCalled()
  expect(window.location.href).toContain('session=local-abc')
})

test('the link is built from the page URL captured on open', async () => {
  await renderDialog()

  expect(mockBuild).toHaveBeenCalledWith(
    'long',
    mockSnapshot,
    'https://share.example/',
    'http://localhost/app/?config=conf.json&session=local-abc',
  )
})

// coming back to short would otherwise upload the same snapshot again
test('switching back to a mode reuses its link', async () => {
  const utils = await renderDialog('short')
  await pickMode(utils, 'Long URL')
  await pickMode(utils, 'Short URL')

  expect(mockBuild.mock.calls.map(c => c[0])).toEqual(['short', 'long'])
  expect(utils.getByDisplayValue(/short-link/)).toBeTruthy()
})

// `json` among them: the dialog made plaintext-JSON links before the readable
// session became a panel under every link
test('an unknown stored mode opens as a short link', async () => {
  await renderDialog('json')

  expect(mockBuild.mock.calls.map(c => c[0])).toEqual(['short'])
})

test.each(['short', 'long'])(
  'a %s link offers the readable session',
  async mode => {
    const utils = await renderDialog(mode)

    fireEvent.click(utils.getByText('Show readable JSON'))
    expect(utils.getByDisplayValue(/"name": "a session"/)).toBeTruthy()
  },
)

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
