import { getFileName } from '@jbrowse/core/util/tracks'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

function makeAccount(picker: { apiKey: string; appId: string }) {
  return stateModelFactory(configSchema).create({
    type: 'GoogleDriveOAuthInternetAccount',
    configuration: {
      type: 'GoogleDriveOAuthInternetAccount',
      internetAccountId: 'testGoogleDrive',
      clientId: 'test-client',
      scopes: 'https://www.googleapis.com/auth/drive.file',
      ...picker,
    },
  })
}

function stubPicker(response: {
  action: string
  docs?: { id: string; name: string }[]
}) {
  const built: { token?: string; apiKey?: string; appId?: string } = {}
  class DocsView {
    setIncludeFolders() {
      return this
    }
    setMode() {
      return this
    }
  }
  class PickerBuilder {
    callback = (_r: typeof response) => {}
    addView() {
      return this
    }
    setOAuthToken(token: string) {
      built.token = token
      return this
    }
    setDeveloperKey(apiKey: string) {
      built.apiKey = apiKey
      return this
    }
    setAppId(appId: string) {
      built.appId = appId
      return this
    }
    setCallback(callback: (r: typeof response) => void) {
      this.callback = callback
      return this
    }
    build() {
      return {
        setVisible: () => {
          this.callback(response)
        },
      }
    }
  }
  window.gapi = {
    load: (_library, { callback }) => {
      callback()
    },
  }
  window.google = {
    picker: {
      PickerBuilder,
      DocsView,
      ViewId: { DOCS: 'all' },
      DocsViewMode: { LIST: 'list' },
      Action: { PICKED: 'picked', CANCEL: 'cancel' },
    },
  }
  return built
}

const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('testGoogleDrive-token', 'drive-file-token')
})

test('no browse button until the Picker key and project number are set', () => {
  expect(makeAccount({ apiKey: '', appId: '' }).browseLabel).toBeUndefined()
  expect(makeAccount({ apiKey: 'key', appId: '123' }).browseLabel).toBe(
    'Browse Google Drive',
  )
})

test('a picked file becomes a Drive link the fetcher and the add-track form both read', async () => {
  const built = stubPicker({
    action: 'picked',
    docs: [{ id: fileId, name: 'my reads.bam' }],
  })
  const location = await makeAccount({
    apiKey: 'key',
    appId: '123',
  }).chooseLocation()

  expect(built).toEqual({
    token: 'drive-file-token',
    apiKey: 'key',
    appId: '123',
  })
  expect(location?.uri).toBe(
    `https://drive.google.com/file/d/${fileId}/my%20reads.bam`,
  )
  expect(location && getFileName(location)).toMatch(/\.bam$/)

  const fetchMock = jest.fn((_input: URL) =>
    Promise.resolve(new Response('data')),
  )
  globalThis.fetch = fetchMock as unknown as typeof fetch
  const account = makeAccount({ apiKey: 'key', appId: '123' })
  await account.getFetcher()(location?.uri ?? '')
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  )
})

test('a file that was pasted rather than picked says to pick it', async () => {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: { message: 'File not found' } }), {
        status: 404,
      }),
    ),
  )
  await expect(
    makeAccount({ apiKey: 'key', appId: '123' }).getFetcher()(
      `https://drive.google.com/file/d/${fileId}/view`,
    ),
  ).rejects.toThrow(
    'HTTP 404 - Google Drive only shares files with JBrowse once they are picked with "Browse Google Drive" - File not found',
  )
})

test('cancelling the Picker resolves to no location', async () => {
  stubPicker({ action: 'cancel' })
  expect(
    await makeAccount({ apiKey: 'key', appId: '123' }).chooseLocation(),
  ).toBeUndefined()
})
