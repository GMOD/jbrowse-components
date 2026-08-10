import { fireEvent, render, waitFor } from '@testing-library/react'

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
    bakePromotedDefaultsIntoSnapshot: (
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

test('a config webExportUrl reroutes the export to that deployment', async () => {
  await renderDialog({
    ...snapshot,
    configuration: { webExportUrl: 'https://inst.example/jbrowse/' },
  })

  const url = new URL(linkValue())
  expect(url.origin + url.pathname).toBe('https://inst.example/jbrowse/')
})
