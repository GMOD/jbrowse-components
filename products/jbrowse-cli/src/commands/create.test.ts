/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

import { mockFetch, runCommand, runInTmpDir } from '../testUtil.ts'

jest.mock('../cliFetch')

const { readdir } = fs.promises

const testZipPath = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'JBrowse2.zip',
)

function readZipAsArrayBuffer() {
  const buf = fs.readFileSync(testZipPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

const releaseArray = [
  {
    tag_name: 'v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/jbrowse-web-v0.0.1.zip',
        name: 'jbrowse-web-v0.0.1.zip',
      },
    ],
  },
]

// GitHub's anonymous API allows 60 requests an hour PER IP and CI runners share
// addresses, so a pinned-tag setup step fails on somebody else's traffic --
// mid-run, on nobody's diff. Actions already puts GITHUB_TOKEN in the
// environment; spend it. Asserted on the header rather than on a rate-limit
// response because the header is the fix and the 403 is only its symptom.
test('authenticates to the GitHub API when the environment offers a token', async () => {
  await runInTmpDir(async () => {
    const before = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'test-token'
    try {
      const fetchMock = mockFetch(url =>
        new URL(url).host === 'api.github.com'
          ? { json: releaseArray[0] }
          : {
              headers: { 'content-type': 'application/zip' },
              arrayBuffer: readZipAsArrayBuffer(),
            },
      )
      // the mock is module-level, so calls survive from earlier tests
      fetchMock.mockClear()
      await runCommand(['create', 'jbrowse', '--tag', 'v0.0.1'])
      const apiCall = fetchMock.mock.calls.find(
        ([url]) => new URL(url.toString()).host === 'api.github.com',
      )
      expect(apiCall?.[1]?.headers).toEqual({
        authorization: 'Bearer test-token',
      })
    } finally {
      if (before === undefined) {
        delete process.env.GITHUB_TOKEN
      } else {
        process.env.GITHUB_TOKEN = before
      }
    }
  })
})

test('sends no authorization header when the environment has no token', async () => {
  await runInTmpDir(async () => {
    const before = { gh: process.env.GITHUB_TOKEN, alt: process.env.GH_TOKEN }
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
    try {
      const fetchMock = mockFetch(url =>
        new URL(url).host === 'api.github.com'
          ? { json: releaseArray[0] }
          : {
              headers: { 'content-type': 'application/zip' },
              arrayBuffer: readZipAsArrayBuffer(),
            },
      )
      // the mock is module-level, so calls survive from earlier tests
      fetchMock.mockClear()
      await runCommand(['create', 'jbrowse', '--tag', 'v0.0.1'])
      const apiCall = fetchMock.mock.calls.find(
        ([url]) => new URL(url.toString()).host === 'api.github.com',
      )
      expect(apiCall?.[1]?.headers).toBeUndefined()
    } finally {
      process.env.GITHUB_TOKEN = before.gh
      process.env.GH_TOKEN = before.alt
      if (before.gh === undefined) {
        delete process.env.GITHUB_TOKEN
      }
      if (before.alt === undefined) {
        delete process.env.GH_TOKEN
      }
    }
  })
})

test('fails if no path is provided to the command', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['create'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('fails if no path is provided to the command, even with force', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['create', '--force'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('fails if user selects a directory that has existing files', async () => {
  const { error } = await runCommand(['create', '.'])
  expect(error?.message).toMatchSnapshot()
})

test('fails if the fetch does not return the right file', async () => {
  await runInTmpDir(async () => {
    mockFetch({ headers: { 'content-type': 'application/json' } })
    const { error } = await runCommand([
      'create',
      'jbrowse',
      '--url',
      'https://example.com/jbrowse-web-v0.0.1.zip',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})

test('download and unzips to new directory', async () => {
  await runInTmpDir(async ctx => {
    mockFetch(url => {
      if (new URL(url).host === 'api.github.com') {
        return { json: releaseArray }
      }
      return {
        headers: { 'content-type': 'application/zip' },
        arrayBuffer: readZipAsArrayBuffer(),
      }
    })
    await runCommand(['create', 'jbrowse'])
    expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
      'manifest.json',
    )
  })
})

test('downloads from a url', async () => {
  await runInTmpDir(async ctx => {
    mockFetch({
      headers: { 'content-type': 'application/zip' },
      arrayBuffer: readZipAsArrayBuffer(),
    })
    await runCommand([
      'create',
      'jbrowse',
      '--url',
      'https://example.com/jbrowse-web-v0.0.1.zip',
    ])
    expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
      'manifest.json',
    )
  })
})

test('overwrites and succeeds in download in a non-empty directory with tag', async () => {
  await runInTmpDir(async ctx => {
    mockFetch(url => {
      if (new URL(url).host === 'api.github.com') {
        return { json: releaseArray[0] }
      }
      return {
        headers: { 'content-type': 'application/zip' },
        arrayBuffer: readZipAsArrayBuffer(),
      }
    })
    await runCommand(['create', 'jbrowse', '--tag', 'v0.0.1', '--force'])
    expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
      'manifest.json',
    )
  })
})

test('fails to download a version that does not exist', async () => {
  await runInTmpDir(async () => {
    mockFetch({ ok: false, status: 404, statusText: 'Not Found' })
    const { error } = await runCommand([
      'create',
      'jbrowse',
      '--tag',
      'v999.999.999',
      '--force',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})

test('fails because this directory is already set up', async () => {
  await runInTmpDir(async () => {
    mockFetch(url => {
      if (new URL(url).host === 'api.github.com') {
        return { json: releaseArray }
      }
      return {
        headers: { 'content-type': 'application/zip' },
        arrayBuffer: readZipAsArrayBuffer(),
      }
    })
    await runCommand(['create', 'jbrowse'])
    const { error } = await runCommand(['create', 'jbrowse'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('lists versions', async () => {
  await runInTmpDir(async () => {
    let page = 1
    mockFetch(() => {
      if (page === 1) {
        page++
        return { json: releaseArray }
      }
      return { json: [] }
    })
    const { stdout } = await runCommand(['create', '--listVersions'])
    expect(stdout).toMatchSnapshot()
  })
})
