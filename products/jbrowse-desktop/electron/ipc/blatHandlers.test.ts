/**
 * @jest-environment node
 *
 * Node, not the default jsdom: this is main-process code.
 */

import { session } from 'electron'

import { BLAT_PARTITION } from '../blatSession.ts'
import { registerBlatHandlers } from './blatHandlers.ts'
import { captureHandlers } from './testUtil.ts'

import type * as WindowModule from '../window.ts'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  session: { fromPartition: jest.fn() },
}))
jest.mock('../window.ts', () => ({
  createChallengeWindow: jest.fn().mockResolvedValue(true),
}))

const { createChallengeWindow } =
  jest.requireMock<typeof WindowModule>('../window.ts')

const fetchMock = jest.fn()
let invoke: ReturnType<typeof captureHandlers>

// A body that streams `chunks` and then ends, which is the shape readCapped
// consumes. `cancel` is recorded so the size-cap test can assert the read is
// actually torn down rather than left draining.
const cancel = jest.fn().mockResolvedValue(undefined)
function streamOf(...chunks: string[]) {
  let i = 0
  return {
    getReader: () => ({
      read: () =>
        Promise.resolve(
          i < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
            : { done: true, value: undefined },
        ),
      cancel,
    }),
  }
}

function respondWith(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  fetchMock.mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(session.fromPartition).mockReturnValue({
    fetch: fetchMock,
  } as unknown as Electron.Session)
  invoke = captureHandlers(() => {
    registerBlatHandlers()
  })
})

test('posts on the BLAT partition, not the default session', async () => {
  // the point of the partition: a POST to whatever host the dialog's server
  // field named no longer carries the app's OAuth cookies, because they are not
  // in this jar. net.fetch (the default session) is what that replaces.
  respondWith(streamOf('{"blat":[]}'))
  const res = await invoke(
    'blatFetch',
    'https://genome.ucsc.edu/cgi-bin/hgBlat',
    'db=hg38',
  )
  expect(session.fromPartition).toHaveBeenCalledWith(BLAT_PARTITION)
  expect(res).toEqual({ ok: true, status: 200, text: '{"blat":[]}' })
  const [url, init] = fetchMock.mock.calls[0]!
  expect(url).toBe('https://genome.ucsc.edu/cgi-bin/hgBlat')
  expect(init.method).toBe('POST')
  expect(init.credentials).toBe('include')
})

test('the request carries a timeout', async () => {
  // nothing in this path can be cancelled — the dialog's Cancel closes the UI
  // and leaves the POST running in main — so the signal is the only thing that
  // ends a request the server never answers
  respondWith(streamOf('ok'))
  await invoke('blatFetch', 'https://example.com/blat', 'db=hg38')
  expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal)
})

test('reassembles a chunked body', async () => {
  respondWith(streamOf('{"fie', 'lds":[]}'))
  const res = await invoke('blatFetch', 'https://example.com/blat', 'db=hg38')
  expect(res.text).toBe('{"fields":[]}')
})

test('an empty body reads as empty text rather than throwing', async () => {
  respondWith(null, { ok: false, status: 502 })
  expect(
    await invoke('blatFetch', 'https://example.com/blat', 'db=hg38'),
  ).toEqual({
    ok: false,
    status: 502,
    text: '',
  })
})

test('refuses a body past the cap instead of buffering it', async () => {
  // an unbounded response.text() would commit main to whatever the server
  // sends; a BLAT answer is a PSL table or a kent error page, both small
  const megabyte = 'x'.repeat(1024 * 1024)
  respondWith(streamOf(...Array.from({ length: 17 }, () => megabyte)))
  await expect(
    invoke('blatFetch', 'https://example.com/blat', 'db=hg38'),
  ).rejects.toThrow(/exceeded/)
  expect(cancel).toHaveBeenCalled()
})

test.each([
  ['file:///etc/passwd', /http or https/],
  ['jbrowse://open', /http or https/],
  ['https://user:pw@example.com/blat', /credentials/],
  ['not a url', /valid BLAT server url/],
])('refuses %s before it reaches the network', async (url, message) => {
  await expect(invoke('blatFetch', url, 'db=hg38')).rejects.toThrow(message)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('the challenge window gets the same validation', async () => {
  // openBlatChallenge takes a renderer url too, and opens it in a real window
  await expect(
    invoke('openBlatChallenge', 'file:///etc/passwd'),
  ).rejects.toThrow(/http or https/)
  expect(createChallengeWindow).not.toHaveBeenCalled()
  expect(await invoke('openBlatChallenge', 'https://genome.ucsc.edu/')).toBe(
    true,
  )
  expect(createChallengeWindow).toHaveBeenCalledWith('https://genome.ucsc.edu/')
})
