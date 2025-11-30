/**
 * @vitest-environment node
 */

import fs from 'fs'
import path from 'path'

import { expect, test, vi } from 'vitest'

import { mockFetch, runCommand, runInTmpDir } from '../testUtil'

vi.mock('../fetchWithProxy')

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
      if (url.includes('api.github.com')) {
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
      if (url.includes('api.github.com')) {
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
    mockFetch({ ok: false, status: 404 })
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
      if (url.includes('api.github.com')) {
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
